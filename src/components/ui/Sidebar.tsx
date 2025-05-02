'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, MessageSquarePlus, LogOut, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ModelSelectionModal } from '@/components/ModelSelectionModal';

export function Sidebar() {
  const [searchQuery, setSearchQuery] = useState('');
  const [conversations, setConversations] = useState<Array<{ id: string; title: string }>>([]);
  const [isModelSelectionOpen, setIsModelSelectionOpen] = useState(false);
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleNewChatClick = () => {
    setIsModelSelectionOpen(true);
  };

  const handleCreateChat = async (modelId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: newConversation, error } = await supabase
        .from('conversations')
        .insert([
          {
            title: 'New Conversation',
            user_id: user.id,
            model: modelId
          }
        ])
        .select()
        .single();

      if (error) throw error;

      if (newConversation) {
        setConversations(prev => [newConversation, ...prev]);
        router.push(`/dashboard/conversation/${newConversation.id}`);
      }
    } catch (error) {
      console.error('Error creating new conversation:', error);
    }
  };

  // Fetch conversations on component mount
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) return;

        const { data, error } = await supabase
          .from('conversations')
          .select('id, title')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (data) {
          setConversations(data);
        }
      } catch (error) {
        console.error('Error fetching conversations:', error);
      }
    };

    fetchConversations();

    // Set up realtime subscription to listen for conversation title changes
    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      // Create subscription channel for table changes
      const channel1 = supabase
        .channel('db-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'conversations',
          },
          (payload) => {
            console.log('Received database update:', payload);
            // Update the conversation in the local state
            setConversations((prevConversations) => 
              prevConversations.map((conv) => 
                conv.id === payload.new.id ? { ...conv, title: payload.new.title } : conv
              )
            );
          }
        )
        .subscribe((status) => {
          console.log('Database subscription status:', status);
        });
        
      // Create a channel for broadcast events (used for immediate updates)
      const channel2 = supabase
        .channel('realtime-updates')
        .on(
          'broadcast',
          { event: 'postgres_changes' },
          (payload) => {
            console.log('Received broadcast update:', payload);
            if (payload.payload && payload.payload.type === 'UPDATE' && 
                payload.payload.table === 'conversations' && 
                payload.payload.new && payload.payload.new.id) {
              // Update the conversation in the local state
              setConversations((prevConversations) => 
                prevConversations.map((conv) => 
                  conv.id === payload.payload.new.id 
                    ? { ...conv, title: payload.payload.new.title } 
                    : conv
                )
              );
            }
          }
        )
        .subscribe((status) => {
          console.log('Broadcast subscription status:', status);
        });

      // Return cleanup function
      return () => {
        channel1.unsubscribe();
        channel2.unsubscribe();
      };
    };

    const cleanup = setupSubscription();
    
    // Clean up subscription when component unmounts
    return () => {
      cleanup.then(unsub => {
        if (unsub) unsub();
      }).catch(err => console.error('Error cleaning up subscription:', err));
    };
  }, []);

  // Filter conversations based on search query
  const filteredConversations = conversations.filter(conversation => 
    conversation.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-64 h-screen bg-white border-r border-gray-200 flex flex-col fixed">
      {/* New Chat Button */}
      <button 
        onClick={handleNewChatClick}
        className="m-4 p-3 flex items-center gap-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <MessageSquarePlus size={20} />
        <span>New Chat</span>
      </button>

      {/* Model Selection Modal */}
      <ModelSelectionModal 
        isOpen={isModelSelectionOpen}
        onClose={() => setIsModelSelectionOpen(false)}
        onSelectModel={handleCreateChat}
      />

      {/* Search Bar */}
      <div className="px-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search conversations..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Conversation History */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length > 0 ? (
          filteredConversations.map((conversation) => (
            <Link
              key={conversation.id}
              href={`/dashboard/conversation/${conversation.id}`}
              className="px-4 py-3 flex items-center gap-2 hover:bg-gray-100 transition-colors"
            >
              <MessageSquarePlus size={16} className="text-gray-500" />
              <span className="text-sm truncate">{conversation.title}</span>
            </Link>
          ))
        ) : (
          <div className="px-4 py-3 text-gray-500 text-sm">
            {searchQuery ? "No conversations found" : "No conversations yet"}
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="border-t border-gray-200 p-4 space-y-2">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2 text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
        
        <Link
          href="/account"
          className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <User size={16} />
          <span>My Account</span>
        </Link>
      </div>
    </div>
  );
} 