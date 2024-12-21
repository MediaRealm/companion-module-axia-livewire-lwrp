import {
	CompanionFeedbackDefinition,
	CompanionFeedbackDefinitions,
	combineRgb,
} from '@companion-module/base';
import { streamNumToMulticastAddr } from './axia_livewire_address_helper';
import { ControllerInstance } from './index';

export enum FeedbackId {
    OutputState = 'OutputState',
}

export function GetFeedbacksList(self: ControllerInstance): CompanionFeedbackDefinitions {
	const feedbacks: { [id in FeedbackId]: CompanionFeedbackDefinition | undefined } = {
		[FeedbackId.OutputState]: {
			type: 'boolean',
			name: 'Change from output source change',
			description: 'If a output is set to a specific source.',
			options: [
                {
                    type: 'number',
					id: 'idOutputNum',
					default: 1,
					label: 'Output Number',
                    min: 1,
                    max: 32767,
                },
				{
					type: 'textinput',
					id: 'idSourceNum',
					default: '1',
					label: 'Source Number',
				},
			],
			defaultStyle: {
				color: combineRgb(0, 0, 0),
				bgcolor: combineRgb(0, 255, 0),
			},
			callback: (feedback): boolean => {
                if (self.lrwpClient === undefined) {
                    self.log("error", "Not connected");
                    return false;
                }

                if (self.lrwpClient.outputsState === null) {
                    self.log("error", "No output data");
                    return false;
                }

                const optOutputNum = feedback.options.idOutputNum;
                if (optOutputNum === undefined) {
                    self.log('error', 'Invalid params');
					return false;
                }

                const outputNum = Number(optOutputNum.toString());
                if (outputNum < 1 || outputNum > 32767) {
                    self.log('error', 'Invalid params');
					return false;
                }


                const optSourceNum = feedback.options.idSourceNum;
                if (optSourceNum === undefined) {
                    self.log('error', 'Invalid params');
					return false;
                }

                const sourceNum = optSourceNum.toString();
                let multicastAddr = '';
                if (sourceNum === '') {
                    self.log('error', 'Invalid params');
					return false;
                } else if (sourceNum.startsWith("sip:")) {
                    multicastAddr = sourceNum;
                } else {
                    multicastAddr = streamNumToMulticastAddr(Number(sourceNum));
                }

                const currentOutput = self.lrwpClient.findOutputLWRP(outputNum);
                if (currentOutput === multicastAddr) {
                    return true;
                }

                return false;
			},
		},
	}

	return feedbacks
}
