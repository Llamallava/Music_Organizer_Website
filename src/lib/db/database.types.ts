export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          user_id: string
          username: string | null
          friend_code: string
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          username?: string | null
          friend_code?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          username?: string | null
          friend_code?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      albums: {
        Row: {
          id: string
          source_provider: string
          source_album_id: string
          title: string
          artist_name: string
          cover_url: string | null
          release_date: string | null
          total_tracks: number
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          source_provider: string
          source_album_id: string
          title: string
          artist_name: string
          cover_url?: string | null
          release_date?: string | null
          total_tracks?: number
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          source_provider?: string
          source_album_id?: string
          title?: string
          artist_name?: string
          cover_url?: string | null
          release_date?: string | null
          total_tracks?: number
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      album_tracks: {
        Row: {
          id: string
          album_id: string
          track_number: number
          title: string
          duration_seconds: number | null
          lyrics: string
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          album_id: string
          track_number: number
          title: string
          duration_seconds?: number | null
          lyrics?: string
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          album_id?: string
          track_number?: number
          title?: string
          duration_seconds?: number | null
          lyrics?: string
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'album_tracks_album_id_fkey'
            columns: ['album_id']
            isOneToOne: false
            referencedRelation: 'albums'
            referencedColumns: ['id']
          },
        ]
      }
      user_saved_albums: {
        Row: {
          id: string
          user_id: string
          album_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          album_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          album_id?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_saved_albums_album_id_fkey'
            columns: ['album_id']
            isOneToOne: false
            referencedRelation: 'albums'
            referencedColumns: ['id']
          },
        ]
      }
      friendships: {
        Row: {
          user_id: string
          friend_user_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          friend_user_id: string
          created_at?: string
        }
        Update: {
          user_id?: string
          friend_user_id?: string
          created_at?: string
        }
        Relationships: []
      }
      review_sections: {
        Row: {
          id: string
          user_saved_album_id: string
          section_type: 'track' | 'conclusion'
          track_number: number | null
          is_interlude: boolean
          notes: string
          score: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_saved_album_id: string
          section_type: 'track' | 'conclusion'
          track_number?: number | null
          is_interlude?: boolean
          notes?: string
          score?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_saved_album_id?: string
          section_type?: 'track' | 'conclusion'
          track_number?: number | null
          is_interlude?: boolean
          notes?: string
          score?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'review_sections_user_saved_album_id_fkey'
            columns: ['user_saved_album_id']
            isOneToOne: false
            referencedRelation: 'user_saved_albums'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
