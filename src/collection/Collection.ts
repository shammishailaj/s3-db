import { getMetadata } from '../utils/Metadata';
import { S3Client, S3Metadata } from '../s3';
import { S3DB } from '../db';
import { SaveBehavior } from './behaviors/SaveBehavior';
import { HeadBehavior } from './behaviors/HeadBehavior';
import { ExistsBehavior } from './behaviors/ExistsBehavior';
import { LoadBehavior } from './behaviors/LoadBehavior';
import { DeleteBehavior } from './behaviors/DeleteBehavior';
import { FindBehavior } from './behaviors/FindBehavior';
import { ReferenceList } from './ReferenceList';
import { CollectionConfiguration } from './Configuration';
import { ConsoleLogger, LogLevel, Logger } from '@mu-ts/logger';

/**
 * Provides the logical interfaces of a collection and translates it into the
 * appropriate S3 calls.
 *
 * Usage: const myCollection: Collection<SomeType> = new Collection(SomeType);
 *
 * The 'SomeType' definition needs to have [prop: string]: any; on it to avoid
 * a TypeScript collission issue when it interprets the 'two types'.
 */
export class Collection<Of> {
  private logger: Logger;
  private type: Of;
  private idPrefix: string | undefined;
  private saveBheavior: SaveBehavior<Of>;
  private existsBehavior: ExistsBehavior<Of>;
  private loadBehavior: LoadBehavior<Of>;
  private deleteBehavior: DeleteBehavior<Of>;
  private findBehavior: FindBehavior<Of>;
  private headBehavior: HeadBehavior<Of>;

  constructor(type: Of, idPrefix?: string) {
    this.type = type;
    this.idPrefix = idPrefix;

    let metadata: any = getMetadata(type);
    if (!metadata) throw TypeError(`The type provided was not properly decorated with @collection('a-name'). Type: ${type}`);

    const name: string = metadata.name;

    this.logger = S3DB.getRootLogger().child(`Collection(${name})`);
    this.logger.info(`init() of ${this.type}`, { prefix: idPrefix });
    this.logger.trace('init() metadata', metadata);

    const configuration: CollectionConfiguration = metadata;
    const fullBucketName = S3DB.getCollectionFQN(name);
    const s3Client = new S3Client(this.logger);

    this.headBehavior = new HeadBehavior(type, configuration, s3Client, fullBucketName, name, this.logger, this.idPrefix);
    this.existsBehavior = new ExistsBehavior(type, configuration, s3Client, fullBucketName, name, this.logger, this.idPrefix);
    this.loadBehavior = new LoadBehavior(type, configuration, s3Client, fullBucketName, name, this.logger, this.idPrefix);
    this.saveBheavior = new SaveBehavior(type, configuration, s3Client, fullBucketName, name, this.logger, this.idPrefix);
    this.deleteBehavior = new DeleteBehavior(type, configuration, s3Client, fullBucketName, name, this.logger, this.idPrefix);
    this.findBehavior = new FindBehavior(type, configuration, s3Client, fullBucketName, name, this.logger, this.idPrefix);
  }

  /**
   *
   * @param level to set the logging for this collection instance.
   */
  public setLogLevel(level: LogLevel): void {
    this.logger.setLevel(level);
  }

  /**
   * The prefix provided will sit in front of all operations for this collection. This means
   * that any ID lookup will add the prefix when looking up the object. So if the prefix is
   * `/users/` then when `.load('1234')` is called the request will result in an ID lookup for
   * `/users/1234`. Similarly, all objects saved will have the prefix applied when the ID is
   * generated by the save operation, or, when an ID is provided and it does not `startWith()`
   * the configured prefix.
   *
   * @param prefix to place all documents within this collection.
   * @param type to map this collection to.
   */
  public subCollection<OfThis>(prefix: string, newType: OfThis): Collection<OfThis> {
    return new Collection<OfThis>(newType, `${this.idPrefix}${prefix}`);
  }

  public async head(id: string): Promise<S3Metadata | undefined> {
    return await this.headBehavior.head(id);
  }

  public async exists(id: string): Promise<boolean> {
    return await this.existsBehavior.exists(id);
  }

  public async load(id: string): Promise<Of> {
    return await this.loadBehavior.load(id);
  }

  public async save(toSave: Of): Promise<Of> {
    return await this.saveBheavior.save(toSave);
  }

  public async delete(id: string): Promise<boolean> {
    return await this.deleteBehavior.delete(id);
  }

  public async find(prefix: string, pageSize?: number, continuationToken?: string): Promise<ReferenceList> {
    return await this.findBehavior.find(prefix, pageSize, continuationToken);
  }
}
