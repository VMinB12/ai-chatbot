import { convertToCoreMessages, Message } from 'ai';

import { models } from '@/ai/models';
import { auth } from '@/app/(auth)/auth';
import {
  deleteChatById,
  getChatById,
  saveChat,
  saveMessages,
} from '@/db/queries';
import { generateUUID, getMostRecentUserMessage } from '@/lib/utils';

import { generateTitleFromUserMessage } from '../../actions';

import { Client, Config } from '@langchain/langgraph-sdk';

export const maxDuration = 60;

const encoder = new TextEncoder();

// ai-sdk has various internal codes for dataStream responses.
// see this link for information about the codes:
// https://github.com/vercel/ai/blob/main/packages/ui-utils/src/stream-parts.ts
const aiMessageCode = '0';
const toolCallCode = '9';
const toolResultCode = 'a';

interface ChunkData {
  input?: any;
  output?: any;
  chunk?: any;
}

function formatAndEnqueue(
  controller: ReadableStreamDefaultController,
  code: string,
  data: any
) {
  const formattedData = `${code}:${JSON.stringify(data)}\n`;
  controller.enqueue(encoder.encode(formattedData));
}

function handleChunk(
  controller: ReadableStreamDefaultController,
  event: string,
  data: ChunkData,
  isStreaming: boolean,
  responseMessages: Array<Message>
) {
  switch (event) {
    case 'on_chat_model_end':
      if (data.output.content) {
        responseMessages.push({
          role: 'assistant',
          content: data.output.content,
          id: data.output.id,
        });
        if (!isStreaming) {
          formatAndEnqueue(controller, aiMessageCode, data.output.content);
        }
      } else if (data.output.tool_calls) {
        data.output.tool_calls.forEach((toolCall: any) => {
          const aiSDKToolCall = {
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            args: toolCall.args,
          };
          formatAndEnqueue(controller, toolCallCode, aiSDKToolCall);
        });
      }
      break;

    case 'on_chat_model_stream':
      if (data.chunk.content) {
        formatAndEnqueue(controller, aiMessageCode, data.chunk.content);
      }
      break;

    case 'on_tool_end': {
      const toolResult = {
        toolCallId: data.output.tool_call_id,
        result: data.output.content,
      };
      // TODO: push tool result to responseMessages
      // responseMessages.push({ ... });
      formatAndEnqueue(controller, toolResultCode, toolResult);
      break;
    }

    default:
      break;
  }
}

export async function POST(request: Request) {
  const {
    id,
    messages,
    modelId,
  }: {
    id: string;
    messages: Array<Message>;
    modelId: string;
  } = await request.json();

  const session = await auth();

  if (!session || !session.user || !session.user.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const model = models.find((model) => model.id === modelId);

  if (!model) {
    return new Response('Model not found', { status: 404 });
  }

  const coreMessages = convertToCoreMessages(messages);
  const userMessage = getMostRecentUserMessage(coreMessages);

  if (!userMessage) {
    return new Response('No user message found', { status: 400 });
  }

  const chat = await getChatById({ id });

  if (!chat) {
    const title =
      model.id === 'dummy'
        ? 'dummy title'
        : await generateTitleFromUserMessage({ message: userMessage });

    await saveChat({ id, userId: session.user.id, title });
  }

  await saveMessages({
    messages: [
      { ...userMessage, id: generateUUID(), createdAt: new Date(), chatId: id },
    ],
  });

  const client = new Client({ apiUrl: 'http://langgraph-api:8000' });
  const assistantID = 'agent';
  const thread = await client.threads.create({
    threadId: id,
    ifExists: 'do_nothing',
  });
  const input = { messages: [userMessage] };
  const config: Config = {
    configurable: {
      llm: model.id,
    },
  };
  // We need to keep track of whether the model is streaming or not.
  let isStreaming = false;
  // This array will store the messages that will be saved in the database
  const responseMessages: Array<Message> = [];

  const streamResponse = client.runs.stream(thread['thread_id'], assistantID, {
    input,
    config,
    streamMode: 'events',
  });

  const stream = new ReadableStream({
    async start(controller) {
      for await (const chunk of streamResponse) {
        if (chunk.data.event && chunk.data.data) {
          if (chunk.data.event === 'on_chat_model_stream') {
            isStreaming = true;
          }
          handleChunk(
            controller,
            chunk.data.event,
            chunk.data.data,
            isStreaming,
            responseMessages
          );
        }
      }
      controller.close();

      try {
        await saveMessages({
          messages: responseMessages.map((message) => {
            return {
              id: generateUUID(),
              chatId: id,
              role: message.role,
              content: message.content,
              createdAt: new Date(),
            };
          }),
        });
      } catch (error) {
        console.error('Failed to save chat');
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: new Headers({
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Vercel-AI-Data-Stream': 'v1',
    }),
  });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response('Not Found', { status: 404 });
  }

  const session = await auth();

  if (!session || !session.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const chat = await getChatById({ id });

    if (chat.userId !== session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    await deleteChatById({ id });

    return new Response('Chat deleted', { status: 200 });
  } catch (error) {
    return new Response('An error occurred while processing your request', {
      status: 500,
    });
  }
}
