import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

/** Stores rendered documents in the S3-compatible object store (MinIO locally). */
@Injectable()
export class ObjectStore {
  private readonly logger = new Logger(ObjectStore.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBase: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.getOrThrow<string>('S3_BUCKET');
    this.publicBase = this.config.getOrThrow<string>('S3_PUBLIC_URL').replace(/\/+$/, '');
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

  /** Put an object at `key` (overwriting) and return its public URL. */
  async put(key: string, body: Uint8Array, contentType: string): Promise<string> {
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
        `object put failed for ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ServiceUnavailableException({
        code: 'upstream_unavailable',
        message: 'Could not store the document right now.',
        devMessage: 'S3 PutObject failed; see media logs for the cause.',
      });
    }
    return `${this.publicBase}/${key}`;
  }
}
