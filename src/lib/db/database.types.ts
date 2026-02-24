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
      playlists: {
        Row: {
          id: string
          user_id: string
          name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      playlist_songs: {
        Row: {
          id: string
          playlist_id: string
          user_saved_album_id: string | null
          track_number: number | null
          source_provider: string | null
          source_song_id: string | null
          song_name: string | null
          artist_name: string | null
          album_title: string | null
          cover_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          playlist_id: string
          user_saved_album_id?: string | null
          track_number?: number | null
          source_provider?: string | null
          source_song_id?: string | null
          song_name?: string | null
          artist_name?: string | null
          album_title?: string | null
          cover_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          playlist_id?: string
          user_saved_album_id?: string | null
          track_number?: number | null
          source_provider?: string | null
          source_song_id?: string | null
          song_name?: string | null
          artist_name?: string | null
          album_title?: string | null
          cover_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'playlist_songs_playlist_id_fkey'
            columns: ['playlist_id']
            isOneToOne: false
            referencedRelation: 'playlists'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'playlist_songs_user_saved_album_id_fkey'
            columns: ['user_saved_album_id']
            isOneToOne: false
            referencedRelation: 'user_saved_albums'
            referencedColumns: ['id']
          },
        ]
      }
      playlist_shares: {
        Row: {
          playlist_id: string
          owner_user_id: string
          shared_with_user_id: string
          created_at: string
        }
        Insert: {
          playlist_id: string
          owner_user_id: string
          shared_with_user_id: string
          created_at?: string
        }
        Update: {
          playlist_id?: string
          owner_user_id?: string
          shared_with_user_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'playlist_shares_playlist_id_fkey'
            columns: ['playlist_id']
            isOneToOne: false
            referencedRelation: 'playlists'
            referencedColumns: ['id']
          },
        ]
      }
      to_listen_songs: {
        Row: {
          id: string
          user_id: string
          song_name: string
          artist_name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          song_name: string
          artist_name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          song_name?: string
          artist_name?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      song_recommendations: {
        Row: {
          id: string
          sender_user_id: string
          receiver_user_id: string
          recommendation_type: 'song' | 'album'
          song_name: string
          artist_name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sender_user_id: string
          receiver_user_id: string
          recommendation_type?: 'song' | 'album'
          song_name: string
          artist_name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sender_user_id?: string
          receiver_user_id?: string
          recommendation_type?: 'song' | 'album'
          song_name?: string
          artist_name?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_events: {
        Row: {
          id: string
          user_id: string
          event_type: 'recommendation_received' | 'recommendation_listened'
          payload: Json
          created_at: string
          read_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          event_type: 'recommendation_received' | 'recommendation_listened'
          payload?: Json
          created_at?: string
          read_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          event_type?: 'recommendation_received' | 'recommendation_listened'
          payload?: Json
          created_at?: string
          read_at?: string | null
        }
        Relationships: []
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
    Functions: {
      update_my_username: {
        Args: {
          next_username: string
        }
        Returns: {
          user_id: string
          username: string | null
          friend_code: string
          created_at: string
          updated_at: string
        }
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
