import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { ToolIcon } from './icons';

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
  const [isOpen, setIsOpen] = useState(false);

  const toggleOpen = () => {
    setIsOpen(!isOpen);
  };

  return (
    <Card key={toolCallId} className="tool-card w-4/5 mx-0">
      <CardHeader onClick={toggleOpen} className="cursor-pointer p-2">
        <div className="flex items-center">
          <ToolIcon />
          <span className="ml-2">{toolName}</span>
        </div>
      </CardHeader>
      {isOpen && (
        <CardContent>
          <div>
            <strong>Args:</strong>
            <pre className="whitespace-pre-wrap break-words">
              {JSON.stringify(args, null, 2)}
            </pre>
          </div>
          {state === 'result' && (
            <>
              <hr className="my-2 border-gray-300" />
              <div>
                <strong>Result:</strong>
                <pre className="whitespace-pre-wrap break-words">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
};

export default Tool;
