export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      conversations: {
        Row: {
          id: string
          created_at: string
          user_id: string
          title: string
          model: string
        }
        Insert: {
          id?: string
          created_at?: string
          user_id: string
          title: string
          model?: string
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string
          title?: string
          model?: string
        }
      }
      messages: {
        Row: {
          id: string
          created_at: string
          user_id: string
          conversation_id: string
          content: string
          isUser: boolean
          is_image: boolean
          image_url?: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          user_id: string
          conversation_id: string
          content: string
          isUser: boolean
          is_image?: boolean
          image_url?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string
          conversation_id?: string
          content?: string
          isUser?: boolean
          is_image?: boolean
          image_url?: string | null
        }
      }
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Insertable<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type Updatable<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'] 