import api from './api';
import { User, UserUpdate } from '@/types';

class ProfileService {

    // aggiorna i dati del profilo utente
    async updateProfile(data: UserUpdate): Promise<User> {
        const response = await api.put<User>('/users/me', data);
        return response.data
    }

    // carica una nuova immagine del profilo
    async uploadProfilePicture(file: File): Promise<User> {
        // validazione lato client per feedback immediato
        if (!file.type.startsWith('image/')) {
            throw new Error('File must be an image');
        }

        // Limite di 5MB
        const maxSize = 5 * 1024 * 1024
        if (file.size > maxSize) {
            throw new Error('Image must be less than 5MB');
        }

        // FormData per upload multipart
        const formData = new FormData();
        formData.append('file', file);

        const response = await api.post<User>('users/me/profile-picture', formData, {
            headers: {
                'Content-Type': undefined as any
            }
        });
        return response.data;
    }

    async deleteProfilePicture(): Promise<User> {
        const response = await api.delete<User>('users/me/profile-picture');
        return response.data;
    }

    createPreviewUrl(file: File): string {
        return URL.createObjectURL(file);
    }

    revokePreviewUrl(url: string): void {
        URL.revokeObjectURL(url);
    }
}

export const profileService = new ProfileService();