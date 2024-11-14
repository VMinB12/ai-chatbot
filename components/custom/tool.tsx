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
    <div
      key={toolCallId}
      className="tool-card p-4 border rounded-md shadow-sm bg-white"
    >
      <strong>{toolName}</strong>
      <div className="tool-card p-4 border rounded-md shadow-sm bg-white">
        Args:<pre>{JSON.stringify(args, null, 2)}</pre>
      </div>
      {state === 'result' && (
        <div className="tool-card p-4 border rounded-md shadow-sm bg-white">
          Result:<pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default Tool;
