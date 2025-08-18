"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Message } from "ai";
import { useChat } from "ai/react";
import { useEffect, useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import React from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Copy, Send, Bot, User, Search, CheckCircle2, Sparkles, Loader2, FileText, Database, RotateCcw, Settings, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type LoadingState = 'idle' | 'thinking' | 'searching' | 'responding' | 'complete';

// Vercel-style Empty State (Greeting)
const ModernEmptyState = () => (
  <div className="mx-auto max-w-2xl px-4">
    <div className="flex flex-col gap-2 rounded-lg border bg-background p-8">
      <h1 className="text-lg font-semibold">Welcome to Beforest AI</h1>
      <p className="text-muted-foreground leading-normal">
        I can help you explore your documents, answer questions, and provide detailed analysis.
        Upload documents in the Knowledge Garden, then ask me anything about them.
      </p>
    </div>
  </div>
);

// Vercel-style Thinking Message
const ModernLoadingMessage = ({ state }: { state: LoadingState }) => {
  return (
    <motion.div
      className="w-full mx-auto max-w-3xl px-4 group/message"
      initial={{ y: 8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ 
        duration: 0.4, 
        ease: "easeOut",
        delay: 0.2
      }}
      data-role="assistant"
    >
      <div className="flex gap-4 w-full">
        <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border bg-background">
          <div className="translate-y-px">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-col gap-4 text-muted-foreground">
            {state === 'thinking' && 'Thinking...'}
            {state === 'searching' && 'Searching knowledge base...'}
            {state === 'responding' && 'Generating response...'}
            {state === 'idle' && 'Processing...'}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Vercel-style Message Component
const ModernMessageBubble = ({ 
  message, 
  onCopy, 
  onRegenerate,
  isLatest, 
  isStreaming,
  isLoading,
  isCopied
}: { 
  message: Message; 
  onCopy: (text: string, messageId: string) => void;
  onRegenerate: () => void;
  isLatest: boolean;
  isStreaming: boolean;
  isLoading: boolean;
  isCopied: boolean;
}) => {
  const isUser = message.role === "user";
  
  return (
    <motion.div
      className="w-full mx-auto max-w-3xl px-4 group/message"
      initial={{ y: 8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ 
        duration: 0.3, 
        ease: "easeOut",
        layout: { duration: 0.2 }
      }}
      data-role={message.role}
    >
      <div className={cn(
        'flex gap-4 w-full group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl',
        'group-data-[role=user]/message:w-fit'
      )}>
        {!isUser && (
          <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border bg-background">
            <div className="translate-y-px">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4 w-full">
          <div className={cn(
            'flex flex-col gap-4',
            isUser && 'bg-primary text-primary-foreground px-3 py-2 rounded-xl'
          )}
          style={{ contain: 'layout' }}>
            {isUser ? (
              <p className="text-sm leading-relaxed">{message.content}</p>
            ) : (
              <>
                <div className="prose prose-sm max-w-none dark:prose-invert prose-p:leading-relaxed prose-p:mb-3 prose-p:mt-0 prose-li:my-1 prose-ul:my-2 prose-ol:my-2">
                  <MemoizedMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                      ul: ({ children }) => <ul className="mb-3 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="mb-3 space-y-1">{children}</ol>,
                      li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                      h1: ({ children }) => <h1 className="text-lg font-semibold mb-2 mt-3 first:mt-0">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-base font-semibold mb-2 mt-3 first:mt-0">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0">{children}</h3>,
                      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                      code: ({ children }) => <code className="bg-muted px-1 py-0.5 rounded text-sm">{children}</code>,
                      pre: ({ children }) => <pre className="bg-muted p-3 rounded-md overflow-x-auto mb-3">{children}</pre>,
                      blockquote: ({ children }) => <blockquote className="border-l-4 border-muted-foreground/20 pl-4 italic my-3">{children}</blockquote>,
                    }}
                  >
                    {message.content}
                  </MemoizedMarkdown>
                  {isStreaming && (
                    <motion.span 
                      className="inline-block w-0.5 h-4 bg-primary ml-1 align-text-bottom"
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ 
                        duration: 1,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    />
                  )}
                </div>
                
                {/* Tool invocations / Sources */}
                {message.toolInvocations && message.toolInvocations.length > 0 && (
                  <div className="border-t pt-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Sources consulted</span>
                    </div>
                    <div className="space-y-2">
                      {message.toolInvocations.map((toolInvocation, idx) => {
                        // Extract document information from tool results
                        const documents = (toolInvocation.state === 'result' ? toolInvocation.result : []) || [];
                        const uniqueDocuments = Array.from(
                          new Map(documents.map((doc: any) => [doc?.fileName, doc])).values()
                        ).filter((doc: any) => doc?.fileName);

                        return (
                          <div key={idx} className="space-y-1">
                            {uniqueDocuments.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {uniqueDocuments.map((doc: any, docIdx: number) => (
                                  <Badge 
                                    key={docIdx} 
                                    variant="outline" 
                                    className="text-xs bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                                  >
                                    <FileText className="w-3 h-3 mr-1" />
                                    {doc.fileName}
                                    {doc.chunkIndex && doc.totalChunks && (
                                      <span className="ml-1 text-emerald-600">
                                        ({doc.chunkIndex}/{doc.totalChunks})
                                      </span>
                                    )}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                <Database className="w-3 h-3 mr-1" />
                                Knowledge Base
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {!isUser && (
            <div className="flex items-center gap-2 opacity-0 group-hover/message:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCopy(message.content, message.id)}
                className={cn(
                  "h-7 text-xs transition-all duration-200",
                  isCopied && "bg-green-50 text-green-700 border-green-200"
                )}
              >
                {isCopied ? (
                  <>
                    <Check className="w-3 h-3 mr-1.5" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 mr-1.5" />
                    Copy
                  </>
                )}
              </Button>
              {isLatest && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRegenerate}
                  disabled={isLoading}
                  className="h-7 text-xs"
                >
                  {isLoading ? (
                    <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3 h-3 mr-1.5" />
                  )}
                  Regenerate
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const MemoizedMarkdown = React.memo(ReactMarkdown);

export default function ChatInterface() {
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [streamingText, setStreamingText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [toolMode, setToolMode] = useState<'auto' | 'required'>('auto');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { messages, input, handleInputChange, handleSubmit: originalHandleSubmit, isLoading, reload, setMessages } = useChat({
    body: {
      toolChoice: 'auto', // Always use auto mode on backend
    },
    onToolCall({ toolCall }) {
      setLoadingState('searching');
    },
    onFinish() {
      setLoadingState('complete');
      setIsTyping(false);
      // Reset to idle after a brief moment
      setTimeout(() => setLoadingState('idle'), 500);
    },
    onError: (error) => {
      toast.error("Something went wrong. Please try again.");
      setLoadingState('idle');
      setIsTyping(false);
    },
  });

  // Custom handleSubmit that modifies the input for required mode
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) return;
    
    // Modify the input if in required mode
    const modifiedInput = toolMode === 'required' 
      ? `${input.trim()}\n\nOnly check my database and don't use your personal knowledge.`
      : input.trim();
    
    // Create a synthetic event with modified input
    const modifiedEvent = {
      ...e,
      target: {
        ...e.target,
        value: modifiedInput
      }
    } as React.FormEvent<HTMLFormElement>;
    
    // Temporarily modify the input value
    const originalValue = input;
    handleInputChange({ target: { value: modifiedInput } } as any);
    
    // Submit with modified input
    originalHandleSubmit(modifiedEvent);
    
    // Reset input to original for display (this happens after submit anyway)
    setTimeout(() => {
      if (input === modifiedInput) {
        handleInputChange({ target: { value: '' } } as any);
      }
    }, 100);
  };

  // Enhanced loading state management with better transitions
  useEffect(() => {
    if (isLoading) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.role === "user") {
        setLoadingState('thinking');
        setIsTyping(false);
        // Natural progression: thinking → responding (unless tool is called)
        const timer = setTimeout(() => {
          setLoadingState('responding');
        }, 1200);
        return () => clearTimeout(timer);
      } else if (lastMessage?.role === "assistant") {
        // AI is responding, enable typewriter
        setIsTyping(true);
      }
    } else {
      setLoadingState('idle');
      setIsTyping(false);
    }
  }, [isLoading, messages]); // Fixed: removed loadingState dependency

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    // Debounce scroll during streaming to reduce jitter
    const timeoutId = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timeoutId);
  }, [messages]);

  const copyToClipboard = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      toast.success("Copied to clipboard!");
      
      // Reset the visual indicator after 2 seconds
      setTimeout(() => {
        setCopiedMessageId(null);
      }, 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const regenerateResponse = async () => {
    if (isLoading) {
      toast.error("Please wait for the current response to complete");
      return;
    }

    // Find the last user message
    const lastUserMessageIndex = messages.findLastIndex(m => m.role === "user");
    if (lastUserMessageIndex === -1) {
      toast.error("No user message found to regenerate from");
      return;
    }

    // Remove all messages after the last user message
    const messagesUpToLastUser = messages.slice(0, lastUserMessageIndex + 1);
    setMessages(messagesUpToLastUser);

    // Use reload to regenerate the response
    setTimeout(() => {
      reload();
    }, 100);

    toast.success("Regenerating response...");
  };

  const shouldShowLoadingMessage = isLoading && loadingState !== 'idle' && loadingState !== 'complete';
  const lastMessage = messages[messages.length - 1];
  const isCurrentlyStreaming = isLoading && lastMessage?.role === "assistant" && !!lastMessage.content;

  return (
    <div className="flex flex-col h-full">
      {/* Tool Mode Toggle and Status in top-right */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-3">
        {/* Tool Mode Toggle */}
        <div className="flex items-center space-x-2 text-xs bg-background/80 backdrop-blur-sm rounded-full px-3 py-1.5 border shadow-sm">
          <Settings className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">Tools:</span>
          <span className={cn(
            "font-medium transition-colors",
            toolMode === 'auto' ? "text-blue-600" : "text-muted-foreground"
          )}>
            Auto
          </span>
          <Switch
            checked={toolMode === 'required'}
            onCheckedChange={(checked) => {
              setToolMode(checked ? 'required' : 'auto');
              toast.success(`Tool mode: ${checked ? 'Required' : 'Auto'}`);
            }}
            className="scale-75"
          />
          <span className={cn(
            "font-medium transition-colors",
            toolMode === 'required' ? "text-orange-600" : "text-muted-foreground"
          )}>
            Required
          </span>
        </div>

        {/* Status indicator when loading */}
        {shouldShowLoadingMessage && (
          <div className="flex items-center space-x-2 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm rounded-full px-3 py-1.5 border shadow-sm">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>{loadingState === 'thinking' ? 'Thinking' : loadingState === 'searching' ? 'Searching' : 'Responding'}...</span>
          </div>
        )}
      </div>

      {/* Reverse Layout Container - Vercel Style */}
      <div className="flex flex-col-reverse h-full">
        {/* Fixed Input at Bottom */}
        <div className="border-t bg-background px-4 sm:px-6 py-3 sm:py-4">
          <form onSubmit={handleSubmit} className="flex space-x-2 sm:space-x-3">
            <div className="flex-1 relative">
              <Input
                value={input}
                onChange={handleInputChange}
                placeholder="Ask me about your documents..."
                disabled={isLoading}
                className={cn(
                  "pr-12 text-sm sm:text-base border-muted-foreground/20 focus:border-primary/50 focus:ring-1 focus:ring-primary/20",
                  isLoading && "opacity-50"
                )}
              />
              {isLoading && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
            <Button 
              type="submit" 
              disabled={isLoading || !input.trim()} 
              size="icon"
              className="w-9 h-9 sm:w-10 sm:h-10"
            >
              <Send className="w-3 h-3 sm:w-4 sm:h-4" />
            </Button>
          </form>
        </div>

        {/* Messages Container - Natural Scroll */}
        <div className="flex-1 overflow-y-auto mobile-scroll mobile-hide-scrollbar">
          <div className="flex flex-col gap-3 sm:gap-4 p-4 sm:p-6">
            {messages.length === 0 ? (
              <ModernEmptyState />
            ) : (
              <AnimatePresence>
                {messages.map((message, index) => (
                  <ModernMessageBubble 
                    key={message.id}
                    message={message} 
                    onCopy={copyToClipboard}
                    onRegenerate={regenerateResponse}
                    isLatest={index === messages.length - 1}
                    isStreaming={isCurrentlyStreaming && index === messages.length - 1}
                    isLoading={isLoading}
                    isCopied={copiedMessageId === message.id}
                  />
                ))}

                {/* Inline loading for current message */}
                {shouldShowLoadingMessage && !isCurrentlyStreaming && (
                  <ModernLoadingMessage state={loadingState} />
                )}
              </AnimatePresence>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}

const StatusIndicator = ({ state }: { state: LoadingState }) => {
  const getStatusConfig = () => {
    switch (state) {
      case 'thinking':
        return {
          icon: <Sparkles className="w-4 h-4 animate-pulse" />,
          text: 'Thinking...',
          color: 'text-blue-600',
          bgColor: 'bg-blue-50 border-blue-200',
        };
      case 'searching':
        return {
          icon: <Search className="w-4 h-4 animate-bounce" />,
          text: 'Searching knowledge base',
          color: 'text-emerald-600',
          bgColor: 'bg-emerald-50 border-emerald-200',
        };
      case 'responding':
        return {
          icon: <Bot className="w-4 h-4 animate-pulse" />,
          text: 'Generating response',
          color: 'text-purple-600',
          bgColor: 'bg-purple-50 border-purple-200',
        };
      default:
        return {
          icon: <Loader2 className="w-4 h-4 animate-spin" />,
          text: 'Processing',
          color: 'text-muted-foreground',
          bgColor: 'bg-muted/10 border-muted-foreground/20',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={cn(
      "flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-300",
      config.color,
      config.bgColor,
      "animate-in slide-in-from-right-2 fade-in duration-300"
    )}>
      {config.icon}
      <span>{config.text}</span>
    </div>
  );
};