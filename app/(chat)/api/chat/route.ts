import { Message } from 'ai';
import { auth } from '@/app/(auth)/auth';
import { deleteChatById, getChatById } from '@/db/queries';
import { Client } from '@langchain/langgraph-sdk';

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
}

function handleChunk(
  controller: ReadableStreamDefaultController,
  event: string,
  data: ChunkData
) {
  if (event.startsWith('on_chat_model')) {
    console.log(
      'CHUNK.DATA.DATA:',
      JSON.stringify(
        data,
        (key, value) => {
          if (Array.isArray(value)) {
            return value.map((item) =>
              typeof item === 'object' ? JSON.stringify(item) : item
            );
          }
          return value;
        },
        2
      )
    );
  }
  if (event === 'on_chat_model_end') {
    console.log('AAAAA', data.output.content);
    if (data.output.content) {
      console.log('BBBBB', data.output.content);
      const content = data.output.content;
      const formattedContent = `${aiMessageCode}:${JSON.stringify(content)}\n`;
      controller.enqueue(encoder.encode(formattedContent));
    } else if (data.output.tool_calls) {
      console.log('CCCCC', data.output.tool_calls);
      for (const toolCall of data.output.tool_calls) {
        const aiSDKToolCall = {
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          args: toolCall.args,
        };
        const formattedToolCall = `${toolCallCode}:${JSON.stringify(aiSDKToolCall)}\n`;
        controller.enqueue(encoder.encode(formattedToolCall));
      }
      // controller.enqueue(encoder.encode(`${toolResultCode}:\n`));
    }
  }
  if (event === 'on_chat_model_stream') {
    const content = data.output.content;
    const formattedContent = `${aiMessageCode}:${JSON.stringify(content)}\n`;
    controller.enqueue(encoder.encode(formattedContent));
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

  const client = new Client({ apiUrl: 'http://langgraph-api:8000' });
  const assistantID = 'agent';
  const thread = await client.threads.create();

  const lastHumanMessage = messages.find((message) => message.role === 'user');
  if (!lastHumanMessage) {
    return new Response('Bad Request', { status: 400 });
  }
  const input = {
    messages: [lastHumanMessage],
  };

  const config = { configurable: {} };

  const streamResponse = client.runs.stream(thread['thread_id'], assistantID, {
    input,
    config,
    streamMode: 'events',
  });

  const stream = new ReadableStream({
    async start(controller) {
      for await (const chunk of streamResponse) {
        console.log(`Receiving new event of type: ${chunk.event}...`);
        console.log('CHUNK.DATA.EVENT:', chunk.data.event);
        if (chunk.data.event && chunk.data.data) {
          handleChunk(controller, chunk.data.event, chunk.data.data);
        }
      }
      controller.close();
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
