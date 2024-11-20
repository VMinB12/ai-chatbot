import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../ui/accordion';
import { ToolIcon } from './icons';

interface ToolInvocation {
  toolName: string;
  toolCallId: string;
  state: string;
  args: any;
  result?: any;
}

interface ToolsProps {
  toolInvocations: ToolInvocation[];
}

const Tools: React.FC<ToolsProps> = ({ toolInvocations }) => {
  return (
    <div className="flex flex-col gap-4">
      {toolInvocations.map((toolInvocation) => {
        const { toolName, toolCallId, state, args, result } = toolInvocation;

        return (
          <Accordion
            key={toolCallId}
            className="w-4/5 mx-0"
            type="single"
            collapsible
          >
            <AccordionItem value={toolCallId}>
              <AccordionTrigger className="cursor-pointer p-2">
                <div className="flex items-center">
                  <ToolIcon />
                  <span className="ml-2">{toolName}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
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
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        );
      })}
    </div>
  );
};

export default Tools;
