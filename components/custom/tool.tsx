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

const Tool: React.FC<ToolInvocation> = ({
  toolName,
  toolCallId,
  state,
  args,
  result,
}) => {
  const renderJson = (data: any) => (
    <pre className="whitespace-pre-wrap break-words">
      {JSON.stringify(data, null, 2)}
    </pre>
  );

  return (
    <AccordionItem key={toolCallId} value={toolCallId}>
      <AccordionTrigger className="cursor-pointer p-2">
        <div className="flex items-center">
          <ToolIcon />
          <span className="ml-2">{toolName}</span>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div>
          <strong>Args:</strong>
          {renderJson(args)}
        </div>
        {result && (
          <>
            <hr className="my-2 border-gray-300" />
            <div>
              <strong>Result:</strong>
              {renderJson(result)}
            </div>
          </>
        )}
      </AccordionContent>
    </AccordionItem>
  );
};

const Tools: React.FC<ToolsProps> = ({ toolInvocations }) => {
  return (
    <Accordion className="w-4/5 mx-0" type="single" collapsible>
      {toolInvocations.map((toolInvocation) => (
        <Tool key={toolInvocation.toolCallId} {...toolInvocation} />
      ))}
    </Accordion>
  );
};

export default Tools;
