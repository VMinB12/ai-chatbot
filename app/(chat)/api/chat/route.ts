import { LangChainAdapter, Message } from 'ai';
import { auth } from '@/app/(auth)/auth';
import { deleteChatById, getChatById } from '@/db/queries';
import { Client } from '@langchain/langgraph-sdk';

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

  const input = {
    messages: messages.map((message) =>
      message.role == 'user'
        ? { role: 'user', content: message.content }
        : { role: 'assistant', content: message.content }
    ),
  };

  const config = { configurable: {} };

  const streamResponse = client.runs.stream(thread['thread_id'], assistantID, {
    input,
    config,
    streamMode: 'events',
  });

  const readableStream = new ReadableStream({
    async start(controller) {
      for await (const chunk of streamResponse) {
        if (chunk.event.startsWith('events')) {
          controller.enqueue(chunk.data);
        }
        console.log(`Receiving new event of type: ${chunk.event}...`);
        console.log('CHUNK.DATA.EVENT:', chunk.data.event);
      }
      controller.close();
    },
  });

  return LangChainAdapter.toDataStreamResponse(readableStream);
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
