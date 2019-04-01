import { HeadObjectRequest, HeadObjectOutput } from 'aws-sdk/clients/s3';
import { CollectionBehavior } from '../Behavior';
import { S3Metadata } from '../../s3';

export class HeadBehavior<Of> extends CollectionBehavior<Of> {
  /**
   * Returns the metadata for a document, without loading the object
   * which is often times much faster and contains enough information
   * to determine if it has been modified.
   *
   * Usage: collection.head(id)
   *
   * @param id of the document to get the head from.
   */
  public async head(id: string): Promise<S3Metadata> {
    try {
      const parameters: HeadObjectRequest = {
        Bucket: this.fullBucketName,
        Key: this.adjustId(id),
      };
      const response: HeadObjectOutput = await this.s3Client.s3.headObject(parameters).promise();
      return this.s3Client.buildS3Metadata(response);
    } catch (error) {
      throw this.s3Client.handleError(error, this.fullBucketName, id);
    }
  }
}
