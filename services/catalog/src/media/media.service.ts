import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { uuidv7 } from 'uuidv7';

export interface UploadResult {
  url: string;
  key: string;
}

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Stores product images in the S3-compatible object store (MinIO locally). */
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBase: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.getOrThrow<string>('S3_BUCKET');
    this.publicBase = this.config
      .getOrThrow<string>('S3_PUBLIC_URL')
      .replace(/\/+$/, '');
    this.client = new S3Client({
      endpoint: this.config.getOrThrow<string>('S3_ENDPOINT'),
      region: this.config.getOrThrow<string>('S3_REGION'),
      forcePathStyle: this.config.get<boolean>('S3_FORCE_PATH_STYLE') ?? true,
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('S3_ACCESS_KEY'),
        secretAccessKey: this.config.getOrThrow<string>('S3_SECRET_KEY'),
      },
    });
  }

  static isSupportedMime(mime: string): boolean {
    return mime in EXT_BY_MIME;
  }

  /** Uploads an image buffer and returns its public URL. Never leaks S3 internals. */
  async uploadProductImage(
    businessId: string,
    productId: string,
    body: Buffer,
    contentType: string,
  ): Promise<UploadResult> {
    const ext = EXT_BY_MIME[contentType] ?? 'bin';
    const key = `businesses/${businessId}/products/${productId}/${uuidv7()}.${ext}`;
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
    } catch (error) {
      this.logger.error(
        `product image upload failed for ${productId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new ServiceUnavailableException({
        code: 'upstream_unavailable',
        message: 'Could not store the image right now. Please try again.',
        devMessage: 'S3 PutObject failed; see catalog logs for the cause.',
      });
    }
    return { url: `${this.publicBase}/${key}`, key };
  }
}
