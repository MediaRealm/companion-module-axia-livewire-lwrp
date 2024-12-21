
import type {
	CompanionActionDefinitions,
	CompanionActionDefinition,
} from '@companion-module/base';
import { streamNumToMulticastAddr } from './axia_livewire_address_helper';
import { ControllerInstance } from './index';

export enum ActionId {
    SendCommand = 'send_command',
    SetOutput = 'set_output',
}

export function GetActionsList(
    self: ControllerInstance,
): CompanionActionDefinitions {

	const actions: { [id in ActionId]: CompanionActionDefinition | undefined } = {
		[ActionId.SendCommand]: {
			name: 'Send Command',
			options: [
				{
					type: 'textinput',
					id: 'id_cmd',
					label: 'Command:',
					tooltip: '',
					default: '',
				},
			],
			callback: async (evt) => {
				self.log('info', `Action: SendCommand`);

				const cmd = evt.options.id_cmd;
				if (cmd === undefined || cmd === '') {
                    self.log('error', 'Invalid params');
					return;
				}

				if (self.lrwpClient === undefined) {
					self.log('error', 'Not connected');
					return;
				}

				await self.lrwpClient.sendCommand(cmd.toString());
			},
		},
        [ActionId.SetOutput]: {
			name: 'Set Output',
			options: [
                {
					type: 'number',
					id: 'idOutputNum',
					label: 'Device Output Number',
					tooltip: '',
					default: 1,
                    min: 1,
                    max: 32767,
				},
				{
					type: 'textinput',
					id: 'idSourceNum',
					label: 'Source Number',
					tooltip: '',
					default: '',
				},
			],
			callback: async (evt) => {
				self.log('info', `Action: SetOutput`);

				if (self.lrwpClient === undefined) {
					self.log('error', 'Not connected');
					return;
				}

                const optOutputNum = evt.options.idOutputNum;
                if (optOutputNum === undefined) {
                    self.log('error', 'Invalid params');
					return;
                }

                const outputNum = Number(optOutputNum.toString());
                if (outputNum < 1 || outputNum > 32767) {
                    self.log('error', 'Invalid params');
					return;
                }

				const optSourceNum = evt.options.idSourceNum;
				if (optSourceNum === undefined) {
                    self.log('error', 'Invalid params');
					return;
				}

                const sourceNum = optSourceNum.toString();
                let multicastAddr = '';
                if (sourceNum === '') {
                    self.log('error', 'Invalid params');
					return;
                } else if (sourceNum.startsWith("sip:")) {
                    multicastAddr = sourceNum;
                } else {
                    multicastAddr = streamNumToMulticastAddr(Number(sourceNum));
                }

                self.log('info', `Action: SetOutput > ${multicastAddr}`);
				await self.lrwpClient.setOutput(outputNum, multicastAddr);
			},
		},
    };

    return actions;
}
