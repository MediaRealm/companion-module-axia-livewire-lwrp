import { SomeCompanionConfigField, Regex } from '@companion-module/base'

export interface IConfig {
	host?: string;
    port?: number;
    password?: string;
}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
            type: 'textinput',
            id: 'host',
            label: 'Target IP',
            width: 12,
            default: "127.0.0.1",
            regex: Regex.IP,
        },
        {
            type: 'number',
            id: 'port',
            label: 'Target Port',
            width: 12,
            default: 93,
            min: 1,
            max: 65535,
        },
        {
            type: 'textinput',
            id: 'password',
            label: 'Password',
            width: 12,
            default: "",
        },
	]
}
