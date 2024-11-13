import { Message } from 'ai';
import { auth } from '@/app/(auth)/auth';
import { deleteChatById, getChatById } from '@/db/queries';
import { Client } from '@langchain/langgraph-sdk';

const encoder = new TextEncoder();

// ai-sdk has various internal codes for dataStream responses.
// see this link for information about the codes:
// https://github.com/vercel/ai/blob/main/packages/ui-utils/src/stream-parts.ts
const ai_code = 0;

interface ChunkData {
  output: {
    content: string;
    additional_kwargs: Record<string, unknown>;
    response_metadata: Record<string, unknown>;
    type: string;
    name: string | null;
    id: string;
    example: boolean;
    tool_calls: Array<unknown>;
    invalid_tool_calls: Array<unknown>;
    usage_metadata: unknown | null;
  };
  input: {
    messages: Array<unknown>;
  };
}

function handleChunk(
  controller: ReadableStreamDefaultController,
  event: string,
  data: ChunkData
) {
  if (event.startsWith('on_chat_model')) {
    console.log('CHUNK.DATA.DATA:', data);
  }
  if (event === 'on_chat_model_end') {
    const content = data.output.content;
    const formattedContent = `${ai_code}:${JSON.stringify(content)}\n`;
    controller.enqueue(encoder.encode(formattedContent));
  }
  if (event === 'on_chat_model_stream') {
    const content = data.output.content;
    const formattedContent = `${ai_code}:${JSON.stringify(content)}\n`;
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
