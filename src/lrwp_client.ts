import { InstanceStatus, LogLevel, TCPHelper } from "@companion-module/base";
import { streamNumToMulticastAddr } from "./axia_livewire_address_helper";
import { FeedbackId } from "./feedback";
import { IRespBase, IRespDestination, IRespType, processResponse } from "./response-messages";

export class LRWPClient {
    private host: string;
	private port: number;
    private password: string | null;
    private logMsg: (level: LogLevel, message: string) => void;
    private updateStatus: (status: InstanceStatus, message?: string | null | undefined) => void;
    private checkFeedbacks: (...feedbackTypes: string[]) => void;
    private socket: TCPHelper | undefined;
    private receivedLines: string[];
    public outputsState: IRespDestination[] | null;

	constructor(
        host: string,
        port: number,
        password: string | null,
        logMsg: (level: LogLevel, message: string) => void,
        updateStatus: (status: InstanceStatus, message?: string | null | undefined) => void,
        checkFeedbacks: (...feedbackTypes: string[]) => void,
    ) {
        this.host = host;
        this.port = port;
        this.password = password;
        this.logMsg = logMsg;
        this.updateStatus = updateStatus;
        this.checkFeedbacks = checkFeedbacks;
        this.socket = undefined;
        this.receivedLines = [];
        this.outputsState = null;
	}

    async connect() {
        if (this.host === '') {
			this.logMsg('error', 'Missing host');
			this.updateStatus(InstanceStatus.BadConfig);
			return;
		}

		if (this.port < 0 || this.port > 65535) {
			this.logMsg('error', 'Missing port');
			this.updateStatus(InstanceStatus.BadConfig);
			return;
		}

		this.logMsg('info', 'Connecting');
		this.updateStatus(InstanceStatus.Connecting);

		this.socket = new TCPHelper(this.host, this.port);

		// https://bitfocus.github.io/companion-module-base/interfaces/TCPHelperEvents.html

		this.socket.on('connect', async () => {
			this.logMsg('info', '[TCP] onConnect');

            // Login to the device.
            await this.login(this.password);

            // Did connect, and did login, so ready now.
			this.updateStatus(InstanceStatus.Ok);

            // Get the state of all the outputs, which seems to
            // subscribe us for all future changes too.
            this.sendCommand("DST");
		});

		this.socket.on('data', async (data) => {
            await this.onData(data);
		});

		this.socket.on('drain', () => {
			this.logMsg('info', '[TCP] onDrain');
		});

		this.socket.on('end', () => {
			this.logMsg('info', '[TCP] onEnd');
		});

		this.socket.on('error', (err) => {
			this.logMsg('info', '[TCP] onError: ' + err.message);
			this.updateStatus(InstanceStatus.ConnectionFailure, err.message);
		});

		this.socket.on('status_change', (status, message) => {
			this.logMsg('info', '[TCP] onStatusChange:' + status + ' - ' + message);
		});
    }

    async destroy() {
        if (this.socket) {
			this.socket.destroy();
			delete this.socket;
			this.logMsg('info', 'Connection destroyed');
		} else {
            this.logMsg('info', 'Connection already destroyed');
        }

		this.updateStatus(InstanceStatus.Disconnected);
	}

    private async onData(data: Buffer) {
        this.logMsg('info', '[TCP] onData');
        const newLines = data.toString().split('\r\n');
        for (const line of newLines) {
            if (line === '') {
                continue;
            }

            this.logMsg('info', ' > received line: ' + line);
            this.receivedLines.push(line);
        }

        const resps = this.processReceivedData();

        // Handle Output response types.
        const respOutputs = resps.filter((resp) => resp.respType === IRespType.Destination) as IRespDestination[];
        await this.onUpdateOutputs(respOutputs);

        // TODO what do we do with the other response types?
    }

    /**
     * Process all the received lines, and figure out if we have
     * a complete block of data yet.
     * 
     * Returns an array of arrays.
     */
    private processReceivedData() {
        const responses: string[][] = [];

        let runningData = [];
        let inBlock = false;
        let processedUntil = -1;
        for (let i = 0; i < this.receivedLines.length; i++) {
            const line = this.receivedLines[i];

            if (line === 'BEGIN') {
                inBlock = true;
                continue;
            }

            if (line === 'END') {
                responses.push(runningData);
                runningData = [];
                inBlock = false;
                processedUntil = i;
                continue;
            }

            if (inBlock === true) {
                // Is part of a block.
                runningData.push(line);
            } else {
                // Is a single line.
                responses.push([line]);
                processedUntil = i;
            }
        }

        this.receivedLines.splice(0, processedUntil + 1);

        const processedResponses: IRespBase[] = [];
        for (const responseLines of responses) {
            const processedResp = processResponse(responseLines);
            processedResponses.push(...processedResp);
        }

        return processedResponses;
    }

    async sendCommand(cmd: string) {
		if (this.socket === undefined || this.socket.isConnected === false) {
			this.logMsg('error', 'Not connected');
			return;
		}

        this.logMsg('info', `Sending: '${cmd}'`);

		const cmdFull = `${cmd}\n`;
        const sendBuf = Buffer.from(cmdFull, 'latin1')
		await this.socket.send(sendBuf);
		this.logMsg('info', 'Sent cmd');
	}
    
    /**
     * Login to the device/server. Required for non-info commands.
     */
    async login(password: string | null) {
        this.logMsg('info', 'Doing login');
        if (password !== null) {
            this.sendCommand("LOGIN " + password);
        } else {
            this.sendCommand("LOGIN");
        }
    }

    /**
     * Set a specific output to a specific source addr.
     */
    async setOutput(outputNum: number, multicastAddr: string) {
        const cmd = `DST ${outputNum} ADDR:${multicastAddr}`;
        await this.sendCommand(cmd);
    }

    /**
     * Find the current output stream number for the specified output.
     */
    findOutputLWRP(outputNum: number): string | null {
        if (this.outputsState === null) {
            return null;
        }

        for (const outputState of this.outputsState) {
            if (outputState.num !== outputNum) {
                continue;
            }

            if (!('address' in outputState.attributes)) {
                continue;
            }

            const address = outputState.attributes.address;
            if (address.startsWith("sip:")) {
                // The active output, in Livewire SIP format
                return outputState.attributes.address;
            }

            if (address.indexOf('.') === -1) {
                // Only provided with a streamNum - convert it to a multicastAddr.
                return streamNumToMulticastAddr(Number(address));
            }

            // Return the full address.
            return address;
        }

        return null;
    }

    private async onUpdateOutputs(resps: IRespDestination[]) {
        console.log('info', 'onUpdateOutputs');

        const retOutputStates: Map<number, IRespDestination> = new Map<number, IRespDestination>();

        // Make a dict of all the existing values.
        if (this.outputsState !== null) {
            for (const outputState of this.outputsState) {
                retOutputStates.set(outputState.num, outputState);
            }
        }

        // Update/replace the state for each output that we received.
        for (const outputState of resps) {
            retOutputStates.set(outputState.num, outputState);
        }

        this.outputsState = [...retOutputStates.values()];
        this.checkFeedbacks(FeedbackId.OutputState);
    }
}
