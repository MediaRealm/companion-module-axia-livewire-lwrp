import { InstanceBase, LogLevel, runEntrypoint, SomeCompanionConfigField } from '@companion-module/base';
import { IConfig, GetConfigFields } from './config';
import { GetActionsList } from './actions';
import {LRWPClient} from './lrwp_client';
import { GetFeedbacksList } from './feedback';

export class ControllerInstance extends InstanceBase<IConfig> {
	public lrwpClient: LRWPClient | undefined;
	private config: IConfig;

	constructor(internal: unknown) {
		super(internal)

		this.config = {}
	}

	/**
	 * Main initialization function called once the module
	 * is OK to start doing things.
	 */
	async init(config: IConfig) {
		this.config = config;
		this.lrwpClient = undefined;

		await this.configUpdated(config);

		this.setFeedbackDefinitions(GetFeedbacksList(this));
		this.setActionDefinitions(GetActionsList(this));
	}

	/**
	 * Process an updated configuration array.
	 */
	public async configUpdated(config: IConfig): Promise<void> {
		this.destroy();

		this.config = config;

		if (
			this.config.host === undefined ||
			this.config.port === undefined ||
			this.config.password === undefined
		) {
			this.log('error', 'Missing config');
			return;
		}

		this.lrwpClient = new LRWPClient(
			this.config.host,
			this.config.port,
			this.config.password,
			this.logMsg.bind(this),
			this.updateStatus.bind(this),
			this.checkFeedbacks.bind(this),
		);
		this.lrwpClient.connect();
	}

	async destroy() {
		this.logMsg('info', 'Destroying module...');
		if (this.lrwpClient !== undefined) {
			await this.lrwpClient.destroy();
		}
		this.logMsg('info', 'Destroyed module...');
	}

	/**
	 * Creates the configuration fields for web config.
	 */
	public getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	logMsg(level: LogLevel, message: string) {
		this.log(level, `[AXIA] ${message}`);
	}
}

runEntrypoint(ControllerInstance, [])
