import { S3Client, S3Metadata } from '../s3'
import { S3DB } from '../db'
import { SaveBehavior } from './behaviors/SaveBehavior'
import { HeadBehavior } from './behaviors/HeadBehavior'
import { ExistsBehavior } from './behaviors/ExistsBehavior'
import { LoadBehavior } from './behaviors/LoadBehavior'
import { DeleteBehavior } from './behaviors/DeleteBehavior'
import { FindBehavior } from './behaviors/FindBehavior'
import { ReferenceList } from './ReferenceList'
import { CollectionConfiguration } from './CollectionConfiguration'
import { Logger, LogLevelString, LoggerService } from '@mu-ts/logger'
import { CollectionRegistry } from './CollectionRegistry'

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
  private logger: Logger
  private configuration: CollectionConfiguration
  private idPrefix: string | undefined
  private saveBheavior: SaveBehavior<Of>
  private existsBehavior: ExistsBehavior<Of>
  private loadBehavior: LoadBehavior<Of>
  private deleteBehavior: DeleteBehavior<Of>
  private findBehavior: FindBehavior<Of>
  private headBehavior: HeadBehavior<Of>

  constructor(type: string | Of, idPrefix?: string) {
    const name = typeof type === 'string' ? type : `${(type as any).name}`

    this.logger = LoggerService.named('S3DB.Collection', { of: `${name}` })
    this.logger.info({ data: { ofType: typeof type, type } }, 'Type of argument provided.')

    if (!name || name === '') throw Error('No type was provided.')

    const resolvedConfiguration: CollectionConfiguration | undefined = CollectionRegistry.instance().resolve(`${name.toLowerCase()}`)
    this.configuration = { ...new CollectionConfiguration(), ...resolvedConfiguration, ...{ type } }

    if (!this.configuration.name) throw Error(`The configuration has no name defined, which is used to determine the bucket name.`)

    this.idPrefix = idPrefix

    const fullBucketName = S3DB.getCollectionFQN(this.configuration.name)
    this.logger.trace({ data: { fullBucketName } }, 'init() fullBucketName')
    const s3Client = new S3Client()

    this.headBehavior = new HeadBehavior(this.configuration, s3Client, fullBucketName, this.idPrefix)
    this.existsBehavior = new ExistsBehavior(this.configuration, s3Client, fullBucketName, this.idPrefix)
    this.loadBehavior = new LoadBehavior(this.configuration, s3Client, fullBucketName, this.idPrefix)
    this.saveBheavior = new SaveBehavior(this.configuration, s3Client, fullBucketName, this.idPrefix)
    this.deleteBehavior = new DeleteBehavior(this.configuration, s3Client, fullBucketName, this.idPrefix)
    this.findBehavior = new FindBehavior(this.configuration, s3Client, fullBucketName, this.idPrefix)

    this.logger.trace({ data: { configuration: this.configuration } }, 'init() configuration')
  }

  /**
   *
   * @param level to set the logging for this collection instance.
   */
  public setLogLevel(level: LogLevelString): void {
    this.logger.level(level)
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
    return new Collection<OfThis>(newType, `${this.idPrefix}${prefix}`)
  }

  public async head(id: string): Promise<S3Metadata | undefined> {
    return this.headBehavior.head(id)
  }

  public async exists(id: string): Promise<boolean> {
    return this.existsBehavior.exists(id)
  }

  public async load(id: string): Promise<Of> {
    return this.loadBehavior.load(id)
  }

  public async save(toSave: Of): Promise<Of> {
    return this.saveBheavior.save(toSave)
  }

  public async delete(id: string): Promise<boolean> {
    return this.deleteBehavior.delete(id)
  }

  public async find(prefix: string, pageSize?: number, continuationToken?: string): Promise<ReferenceList> {
    return this.findBehavior.find(prefix, pageSize, continuationToken)
  }
}
