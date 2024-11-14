import React from 'react';

interface ToolInvocation {
  toolName: string;
  toolCallId: string;
  state: string;
  args: any;
  result?: any;
}

interface ToolProps {
  toolInvocation: ToolInvocation;
}

const Tool: React.FC<ToolProps> = ({ toolInvocation }) => {
  const { toolName, toolCallId, state, args, result } = toolInvocation;

  return (
    <div key={toolCallId}>
      <div>
        <strong>{toolName}</strong>
        <pre>{JSON.stringify(args, null, 2)}</pre>
      </div>
      {state === 'result' && (
        <div>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default Tool;
