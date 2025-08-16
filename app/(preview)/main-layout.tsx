'use client';

import { useState } from 'react';
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import ChatInterface from "@/components/chat-interface";
import KnowledgeGarden from "@/components/knowledge-garden/knowledge-garden";
import { Separator } from "@/components/ui/separator";

export default function MainLayout() {
  const [activeTab, setActiveTab] = useState('chat');

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <SidebarInset>
        {/* Header with sidebar trigger */}
        <header className="flex h-16 shrink-0 items-center gap-2 px-4 border-b">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">
              {activeTab === 'chat' ? 'AI Assistant' : 'Knowledge Garden'}
            </h1>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex flex-1 flex-col h-[calc(100vh-4rem)]">
          {activeTab === 'chat' && <ChatInterface />}
          {activeTab === 'knowledge-garden' && <KnowledgeGarden />}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}