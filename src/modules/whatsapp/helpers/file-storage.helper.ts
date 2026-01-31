import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

export class FileStorageHelper {
  /**
   * Ensure upload directory exists
   */
  private async ensureUploadDir(): Promise<void> {
    try {
      await fs.access(UPLOAD_DIR);
    } catch {
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
    }
  }

  /**
   * Save media file to local storage
   */
  async saveMediaFile(
    buffer: Buffer,
    mimeType: string,
    originalFilename?: string
  ): Promise<string> {
    await this.ensureUploadDir();

    const extension = mimeType.split('/')[1].split(';')[0]; // Handle "audio/ogg; codecs=opus"
    const filename = originalFilename || `${uuidv4()}.${extension}`;
    const filepath = path.join(UPLOAD_DIR, filename);

    await fs.writeFile(filepath, buffer);

    // Return relative path for database and public access
    return `/uploads/${filename}`;
  }

  /**
   * Delete media file from local storage
   */
  async deleteMediaFile(localPath: string): Promise<void> {
    try {
      const filepath = path.join(process.cwd(), 'public', localPath);
      await fs.unlink(filepath);
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  }
}
