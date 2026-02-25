import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { HttpException, HttpStatus, Injectable } from "@nestjs/common"

@Injectable()
export class AwsService {
  private s3Client: S3Client;
  private bucketName: string;
  private cloudfrontDomain: string;

  constructor() {
    const bucketName = process.env.AWS_BUCKET_NAME
    const region = process.env.AWS_BUCKET_REGION
    const accessKeyId = process.env.AWS_ACCESS_KEY
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
    const cloudfrontUrl = process.env.AWS_CLOUDFRONT_URL

    if (!bucketName || !region || !accessKeyId || !secretAccessKey) {
      throw new HttpException('AWS configuration is missing', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    if (!cloudfrontUrl) {
      throw new HttpException('AWS_CLOUDFRONT_URL is missing', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    this.bucketName = bucketName;
    this.cloudfrontDomain = cloudfrontUrl;
    this.s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey
      }
    })
  }

  public async uploadFile(fileBuffer: Buffer, fileName: string, mimetype: string) {
    const uploadParams = {
      Bucket: this.bucketName,
      Body: fileBuffer,
      Key: fileName,
      ContentType: mimetype
    }

    return this.s3Client.send(new PutObjectCommand(uploadParams));
  }

  public async deleteFile(fileName: string) {
    const deleteParams = {
      Bucket: this.bucketName,
      Key: fileName,
    }

    return this.s3Client.send(new DeleteObjectCommand(deleteParams));
  }

  public async getObjectSignedUrl(key: string) {
    const params = {
      Bucket: this.bucketName,
      Key: key
    }

    const command = new GetObjectCommand(params);
    const seconds = 60
    const url = await getSignedUrl(this.s3Client, command, { expiresIn: seconds });

    return url
  }

  /**
   * Get a public CloudFront URL for a given S3 key
   */
  public getCloudFrontUrl(key: string): string {
    const domain = this.cloudfrontDomain.replace(/\/$/, '');
    return `${domain}/${key}`;
  }

  /**
   * Upload file to S3 and return the public CloudFront URL
   */
  public async uploadFileAndGetUrl(fileBuffer: Buffer, fileName: string, mimetype: string): Promise<string> {
    await this.uploadFile(fileBuffer, fileName, mimetype);
    return this.getCloudFrontUrl(fileName);
  }
}

export default AwsService;