/**
 * Parse all the lines from a response, and put them into an array of objects.
 */
export function processResponse(responseLines: string[]): IRespBase[] {
    const allResps: IRespBase[] = [];

    for (let i = 0; i < responseLines.length; i++) {
        const x = responseLines[i];

        // Split into key and value, on the first space.
        const splitPos = x.indexOf(' ');
        if (splitPos === -1) {
            throw Error("Missing split");
        }
        const attrKey = x.slice(0, splitPos);
        const unsplitSegments = x.slice(splitPos+1);
        const segments = splitSegments(unsplitSegments);

        switch (attrKey) {
            case 'VER':
                const respDevice: IRespDevice = {
                    respType: IRespType.Device,
                    attributes: parseAttributes(segments),
                }
    
                allResps.push(respDevice);

                break;
            case "IP":
                const respNetwork: IRespNetwork = {
                    respType: IRespType.Network,
                    attributes: parseAttributes(segments),
                }
    
                allResps.push(respNetwork);

                break;
            case "SET":
                const respSet: IRespSet = {
                    respType: IRespType.Set,
                    attributes: parseAttributes(segments),
                }
    
                allResps.push(respSet);

                break;
            case "SRC":
                const respSource: IRespSource = {
                    respType: IRespType.Source,
                    num: segments[0],
                    attributes: parseAttributes(segments.slice(1)),
                }
    
                allResps.push(respSource);

                break;
            case "DST":
                const respDestination: IRespDestination = {
                    respType: IRespType.Destination,
                    num: Number(segments[0]),
                    attributes: parseAttributes(segments.slice(1)),
                }
    
                allResps.push(respDestination);

                break;
            case "MTR":
                let io1: "in" | "out" | "unknown" = "unknown";
                if (segments[0] === "ICH") {
                    io1 = "in";
                } else if (segments[0] === "OCH") {
                    io1 = "out";
                }

                const respMeter: IRespMeter = {
                    respType: IRespType.Meter,
                    io: io1,
                    num: segments[1],
                    attributes: parseAttributes(segments.slice(2)),
                }
    
                allResps.push(respMeter);

                break;
            case "LVL":
                let io2: "in" | "out" | "unknown" = "unknown";
                if (segments[0] === "ICH") {
                    io2 = "in";
                } else if (segments[0] === "OCH") {
                    io2 = "out";
                }

                const respLevelAlert: IRespLevelAlert = {
                    respType: IRespType.LevelAlert,
                    io: io2,
                    num: segments[1].split(".")[0],
                    side: segments[1].split(".")[1],
                    attributes: parseAttributes(segments.slice(2)),
                }
    
                allResps.push(respLevelAlert);

                break;
            case "GPI":
                // TODO this isn't fully implemented - pin states.
                const respGPI: IRespGPI = {
                    respType: IRespType.GPI,
                    num: segments[0],
                    attributes: parseAttributes(segments.slice(1)),
                }
    
                allResps.push(respGPI);

                break;
            case "GPO":
                // TODO this isn't fully implemented - pin states.
                const respGPO: IRespGPO = {
                    respType: IRespType.GPO,
                    num: segments[0],
                    attributes: parseAttributes(segments.slice(1)),
                }
    
                allResps.push(respGPO);

                break;
            case "MIX":
                const srcPoints = segments.slice(1).map((point) => {
                    const sPoint = point.split(":");
                    if (sPoint.length >= 2 && sPoint[0] !== "" && sPoint[1] !== "-") {
                        const ret: IMatrixSrc = {
                            num:  Number(sPoint[0]),
                            level: Number(sPoint[1]),
                        };
                        return ret;
                    }

                    return undefined;
                });
                
                // filter out undefined;
                const srcPointsFiltered = srcPoints.flatMap((val) => {
                    return val === undefined ? [] : [val];
                });

                const respMatrix: IRespMatrix = {
                    respType: IRespType.Matrix,
                    dst: Number(segments[0]),
                    src: srcPointsFiltered,
                }
    
                allResps.push(respMatrix);

                break;
            case "ERROR":
                const respError: IRespError = {
                    respType: IRespType.Error,
                    message: unsplitSegments,
                }
    
                allResps.push(respError);

                break;
            default:
                console.log(`Unknown type: ${attrKey} ----- ${unsplitSegments}`);
        }
    }

    return allResps;
}

/**
 * Attempt to parse all the segments provided in return data
 */
function splitSegments(line: string) {
    line += " ";

    const segments: string[] = [];
    let currentText = "";
    let inSubStr = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];

        if (c === " " && inSubStr === false) {
            // Finish the segment
            segments.push(currentText);
            currentText = "";
        } else {
            // Continue the segment
            if (c === '"' && inSubStr === false) {
                inSubStr = true;
            } else if (c === '"' && inSubStr === true) {
                inSubStr = false;
            } else {
                currentText += c;
            }   
        }
    }

    return segments;
}

/**
 * Parse all known attributes for a command and return in a dictionary.
 */
function parseAttributes(segments: string[]) {
    const attrs: {[key: string]: string} = {};

    for (let i = 0; i < segments.length; i++) {
        const x = segments[i];

        // Split into key and value, on the first colon (or space).
        let splitPos = x.indexOf(':');
        if (splitPos === -1) {
            console.log("Unable to find split in segment: ", x);
            continue;
        }

        const attrKey = x.slice(0, splitPos);
        const attrValue = x.slice(splitPos+1);

        switch (attrKey) {
            case 'PEEK':
                // Peak level meters
                // TODO: Convert to a proper format
                const sPeek = attrValue.split(":");
                attrs["PEAK_L"] = sPeek[0];
                attrs["PEAK_R"] = sPeek[1];
                break;
            case "RMS":
                // RMS level meters
                // TODO: Convert to a proper format
                const sRms = attrValue.split(":");
                attrs["RMS_L"] = sRms[0];
                attrs["RMS_R"] = sRms[1];
                break;
            case "LWRP":
                attrs["protocol_version"] = attrValue;
                break;
            case "DEVN":
                attrs["device_name"] = attrValue;
                break;
            case "SYSV":
                attrs["system_version"] = attrValue;
                break;
            case "NSRC":
                // only parse source type if available
                if (attrValue.includes("/")) {
                    const sNsrc = attrValue.split("/");
                    attrs["source_count"] = sNsrc[0];
                    attrs["source_type"] = sNsrc[1];
                } else {
                    attrs["source_count"] = attrValue;
                    attrs["source_type"] = ''
                }

                break;
            case "NDST":
                attrs["destination_count"] = attrValue;
                break;
            case "NGPI":
                attrs["GPI_count"] = attrValue;
                break;
            case "NGPO":
                attrs["GPO_count"] = attrValue;
                break;
            case "MIXCFG:1":
                // TODO previously returned proper bool type.
                attrs["matrix_enabled"] = "true";
                break;
            case "MIXCFG:0":
                // TODO previously returned proper bool type.
                attrs["matrix_enabled"] = "false";
                break;
            case "MIX":
                attrs["matrix_channels"] = attrValue;
                break;
            case "address":
                attrs["ip_address"] = segments[i + 1];
                break;
            case "netmask":
                attrs["ip_netmask"] = segments[i + 1];
                break;
            case "gateway":
                attrs["ip_gateway"] = segments[i + 1];
                break;
            case "hostname":
                attrs["ip_hostname"] = segments[i + 1]
                break;
            case "ADIP":
                attrs["advertisment_ipaddress"] = attrValue;
                break;
            case "IPCLK_ADDR":
                attrs["clock_ipaddress"] = attrValue;
                break;
            case "NIC_IPADDR":
                attrs["nic_ipaddress"] = attrValue;
                break;
            case "NIC_NAME":
                attrs["nic_name"] = attrValue;
                break;
            case "PSNM":
                attrs["name"] = attrValue;
                break;
            case "LWSE":
                if (attrValue == "1") {
                    // TODO previously returned proper bool type.
                    attrs["livestream"] = "true";
                } else {
                    // TODO previously returned proper bool type.
                    attrs["livestream"] = "false";
                }

                break;
            case "LWSA":
                attrs["livestream_destination"] = attrValue;
                break;
            case "RTPE":
                if (attrValue === "1") {
                    // TODO previously returned proper bool type.
                    attrs["rtp"] = "true";
                } else {
                    // TODO previously returned proper bool type.
                    attrs["rtp"] = "false";
                }

                break;
            case "RTPA":
                attrs["rtp_destination"] = attrValue;
                break;
            case "ADDR":
                if (attrValue === '' || attrValue.startsWith("0.0.0.0")) {
                    // TODO previously returned proper none type.
                    attrs["address"] = "";
                } else if (attrValue.includes(" ")) {
                    // Sometimes other data is provides in this field after the actual address
                    // Discard that extra info and just return the address
                    attrs['address'] = attrValue.split(" ")[0];
                } else {
                    attrs["address"] = attrValue
                }

                break;
            case "NAME":
                attrs["name"] = attrValue;
                break;
            case "CLIP":
                // TODO previously returned proper bool type.
                attrs["clip"] = "true";
                break;
            case "NO-CLIP":
                // TODO previously returned proper bool type.
                attrs["clip"] = "false";
                break;
            case "LOW":
                // TODO previously returned proper bool type.
                attrs["silence"] = "true";
                break;
            case "NO-LOW":
                // TODO previously returned proper bool type.
                attrs["silence"] = "false";
                break;
            case "CMD":
                attrs["command_text"] = attrValue;
                break;
            default:
                attrs["UNKNOWN_" + attrKey] = attrValue;
                break;
        }

    }

    return attrs;
}

export enum IRespType {
    Device = 'device',
    Network = 'network',
    Set = 'set',
    Source = 'source',
    Destination = 'destination',
    Meter = 'meter',
    LevelAlert = 'level_alert',
    GPI = "gpi",
    GPO = "gpo",
    Matrix = "matrix",
    Error = "error",
}

export interface IRespBase {
    respType: IRespType,
}

export interface IRespDevice extends IRespBase {
    respType: IRespType.Device,
    attributes: {
        [key: string]: string;
    }
}

export interface IRespNetwork extends IRespBase {
    respType: IRespType.Network,
    attributes: {
        [key: string]: string;
    }
}

export interface IRespSet extends IRespBase {
    respType: IRespType.Set,
    attributes: {
        [key: string]: string;
    }
}

export interface IRespSource extends IRespBase {
    respType: IRespType.Source,
    num: string;
    attributes: {
        [key: string]: string;
    }
}

export interface IRespDestination extends IRespBase {
    respType: IRespType.Destination,
    num: number;
    attributes: {
        [key: string]: string;
    }
}

export interface IRespMeter extends IRespBase {
    respType: IRespType.Meter,
    io: 'in' | 'out' | 'unknown';
    num: string;
    attributes: {
        [key: string]: string;
    }
}

export interface IRespLevelAlert extends IRespBase {
    respType: IRespType.LevelAlert,
    io: 'in' | 'out' | 'unknown';
    num: string;
    side: string;
    attributes: {
        [key: string]: string;
    }
}

export interface IRespGPI extends IRespBase {
    respType: IRespType.GPI,
    num: string;
    attributes: {
        [key: string]: string;
    }
}

export interface IRespGPO extends IRespBase {
    respType: IRespType.GPO,
    num: string;
    attributes: {
        [key: string]: string;
    }
}

export interface IRespMatrix extends IRespBase {
    respType: IRespType.Matrix,
    dst: number;
    src: IMatrixSrc[];
}

export interface IMatrixSrc {
    num: number;
    level: number;
}

export interface IRespError extends IRespBase {
    respType: IRespType.Error,
    message: string;
}