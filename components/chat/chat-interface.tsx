"use client";

import { useState, useEffect, useMemo } from "react";
import { useChat } from "ai/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Send, 
  Copy, 
  RotateCcw, 
  FileText, 
  User, 
  Bot,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";

interface SourceCitation {
  name: string;
  similarity: number;
  fileName?: string;
  fileType?: string;
  chunkIndex?: number;
  totalChunks?: number;
}

export default function ChatInterface() {
  const [toolCall, setToolCall] = useState<string>();
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    toolChoice: 'auto',
    onToolCall({ toolCall }) {
      setToolCall(toolCall.toolName);
    },
    onError: (error) => {
      toast.error("An error occurred. Please try again.");
    },
  });

  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  useEffect(() => {
    if (messages.length > 0) setIsExpanded(true);
  }, [messages]);

  const currentToolCall = useMemo(() => {
    const lastMessage = messages?.slice(-1)[0];
    
    if (isLoading && toolCall) {
      return toolCall;
    }
    
    const tools = lastMessage?.toolInvocations;
    if (tools && tools.length > 0) {
      const hasResults = tools.every(tool => tool.result !== undefined);
      if (!hasResults) {
        return tools[0].toolName;
      }
    }
    
    return undefined;
  }, [toolCall, messages, isLoading]);

  const awaitingResponse = useMemo(() => {
    if (
      isLoading &&
      currentToolCall === undefined &&
      messages.slice(-1)[0]?.role === "user"
    ) {
      return true;
    } else {
      return false;
    }
  }, [isLoading, currentToolCall, messages]);

  const clearConversation = () => {
    window.location.reload();
  };

  return (
    <div className="flex flex-col items-center w-full max-w-[600px] mx-auto">
      {/* Header - Only show when no messages */}
      {messages.length === 0 && (
        <motion.div 
          className="w-full mb-8 text-center"
          initial={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          <h1 className="text-4xl font-bold text-foreground bg-gradient-to-r from-[#344736] to-[#86312b] bg-clip-text text-transparent mb-2">
            Beforest Assistant
          </h1>
          <p className="text-[#51514d] text-lg">
            Ask questions about your knowledge base
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <Badge variant="outline" className="border-[#b8dc99] text-[#344736]">
              <Sparkles className="h-3 w-3 mr-1" />
              Azure OpenAI
            </Badge>
            <Badge variant="outline" className="border-[#b8dc99] text-[#344736]">
              RAG Powered
            </Badge>
          </div>
        </motion.div>
      )}

      {/* Compact header when chatting */}
      {messages.length > 0 && (
        <div className="w-full flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-r from-[#344736] to-[#86312b]" />
            <span className="font-semibold text-[#344736]">Beforest</span>
          </div>
          <Button variant="ghost" size="sm" onClick={clearConversation} className="text-[#51514d]">
            <RotateCcw className="h-4 w-4 mr-1" />
            New
          </Button>
        </div>
      )}

      {/* Chat Messages Container */}
      <div
        className={`rounded-xl w-full transition-all duration-300 ${
          isExpanded
            ? "bg-gradient-to-b from-[#fdfbf7] to-[#e7e4df]/30 border-2 border-[#e7e4df] p-4"
            : "bg-transparent p-0"
        }`}
        style={{
          minHeight: isExpanded ? 200 : 0,
        }}
      >
        {/* Full Conversation Chain */}
        <div className="space-y-6">
          <AnimatePresence initial={false}>
            {messages.map((message, index) => (
              <motion.div 
                key={message.id || `${message.role}-${index}`} 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                layout
              >
                {message.role === 'user' && (
                  <UserMessage message={message.content} />
                )}
                {message.role === 'assistant' && (
                  <AssistantMessage message={message} />
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Loading State */}
          <AnimatePresence mode="wait">
            {(awaitingResponse || currentToolCall) && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <LoadingIndicator tool={currentToolCall} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="w-full mt-4">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            placeholder="Ask me anything about your documents..."
            onChange={handleInputChange}
            className="flex-1 min-h-[50px] resize-none bg-[#fdfbf7] border border-[#e7e4df] focus:border-[#344736] focus-visible:ring-0 focus-visible:ring-offset-0 text-[#51514d] placeholder:text-[#51514d]/40 rounded-xl px-4 py-3"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as any);
              }
            }}
            disabled={isLoading}
          />
          <Button 
            type="submit" 
            disabled={!input.trim() || isLoading}
            className="h-[50px] px-4 bg-gradient-to-r from-[#344736] to-[#86312b] hover:from-[#344736]/90 hover:to-[#86312b]/90 text-white rounded-xl disabled:opacity-50 flex items-center justify-center"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}

function UserMessage({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 justify-end">
      <div className="flex-1 space-y-1">
        <div className="bg-gradient-to-r from-[#344736] to-[#86312b] text-white rounded-2xl rounded-tr-md px-4 py-3 max-w-[85%] w-fit ml-auto shadow-sm">
          <p className="text-sm leading-relaxed">{message}</p>
        </div>
        <p className="text-xs text-[#51514d]/60 text-right mr-2">
          You • {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ffc083] to-[#ff774a] flex items-center justify-center">
        <User className="w-4 h-4 text-[#344736]" />
      </div>
    </div>
  );
}

function AssistantMessage({ message }: { message: any }) {
  const extractedSources = useMemo(() => {
    if (!message.toolInvocations) return [];
    
    const infoTool = message.toolInvocations.find((tool: any) => tool.toolName === 'getInformation');
    if (infoTool?.result) {
      return infoTool.result as SourceCitation[];
    }
    return [];
  }, [message.toolInvocations]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#344736] to-[#86312b] flex items-center justify-center">
        <Bot className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 space-y-3">
        {/* Message Content */}
        <div className="bg-white border-2 border-[#e7e4df] rounded-2xl rounded-tl-md px-4 py-3 shadow-sm">
          <div className="prose prose-sm max-w-none text-[#51514d]">
            <ReactMarkdown 
              components={{
                p: ({ children }) => <p className="text-sm leading-relaxed mb-2 last:mb-0">{children}</p>,
                strong: ({ children }) => <strong className="font-semibold text-[#344736]">{children}</strong>,
                ul: ({ children }) => <ul className="list-disc pl-4 space-y-1">{children}</ul>,
                li: ({ children }) => <li className="text-sm">{children}</li>
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        </div>
        
        {/* Source Citations */}
        {extractedSources.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-[#b8dc99] flex items-center justify-center">
                <FileText className="h-2.5 w-2.5 text-[#344736]" />
              </div>
              <p className="text-xs font-medium text-[#51514d]">
                Sources ({extractedSources.length})
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {extractedSources.slice(0, 3).map((source, index) => (
                <Badge 
                  key={index} 
                  variant="outline" 
                  className="text-xs cursor-pointer hover:bg-[#b8dc99]/20 border-[#b8dc99] text-[#344736] transition-colors flex items-center gap-1.5 px-3 py-1.5"
                  onClick={() => {
                    const sourceInfo = source.fileName 
                      ? `${source.fileName} (${source.fileType?.toUpperCase()})${source.chunkIndex !== undefined ? ` - Part ${source.chunkIndex + 1}/${source.totalChunks}` : ''}`
                      : source.name.slice(0, 50) + '...';
                    toast.info(`Source: ${sourceInfo}`);
                  }}
                >
                  <FileText className="h-3 w-3" />
                  <div className="flex flex-col items-start">
                    <span className="font-medium">
                      {source.fileName || 'Document'}
                    </span>
                    {source.fileType && (
                      <span className="text-[10px] opacity-75">
                        {source.fileType.toUpperCase()}
                        {source.chunkIndex !== undefined && source.totalChunks && (
                          <> • Part {source.chunkIndex + 1}/{source.totalChunks}</>
                        )}
                      </span>
                    )}
                  </div>
                  {source.similarity && (
                    <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-[#b8dc99] text-[#344736] rounded-full font-medium">
                      {Math.round(source.similarity * 100)}%
                    </span>
                  )}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Message Actions */}
        <div className="flex items-center gap-1">
          <p className="text-xs text-[#51514d]/70">
            AI Assistant • {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
          <div className="flex-1" />
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => copyToClipboard(message.content)}
            className="h-7 px-2 text-xs hover:bg-[#e7e4df] text-[#51514d]"
          >
            <Copy className="h-3 w-3 mr-1" />
            Copy
          </Button>
        </div>
      </div>
    </div>
  );
}

function LoadingIndicator({ tool }: { tool?: string }) {
  const toolName = 
    tool === "getInformation"
      ? "Getting information"
      : tool === "addResource"
        ? "Adding information"
        : "Thinking";

  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#344736] to-[#86312b] flex items-center justify-center">
        <Bot className="w-4 h-4 text-white" />
      </div>
      <div className="bg-white border-2 border-[#e7e4df] rounded-2xl rounded-tl-md px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="animate-spin w-4 h-4 border-2 border-[#e7e4df] border-t-[#344736] rounded-full" />
          <span className="text-sm text-[#51514d]">{toolName}...</span>
        </div>
      </div>
    </div>
  );
}