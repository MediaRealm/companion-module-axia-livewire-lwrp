/**
 * Helper methods for Axia Livewire Audio-Over-IP Multicast Addresses.
 */

export enum StreamFormat {
    Standard = "standard",
    Livestream = "livestream",
    BackfeedStandard = "backfeed_standard",
    BackfeedLivestream = "backfeed_livestream",
    Surround = "surround",
}

/**
 * Takes a stream number and stream format, and returns the multicast address for the audio.
 */
export function streamNumToMulticastAddr(streamNum: number, format?: StreamFormat) {
    if (format === undefined) {
        format = StreamFormat.Standard;
    }

    if (streamNum < 0 || streamNum > 65535) {
        throw Error("streamNum out of range");
    }

    const startAddress = streamFormatBaseIp(format);
    const startAddressDecimal = ipToDecimal(startAddress);
    return decimalToIp(streamNum + startAddressDecimal);
}

/**
 * Takes a multicast address and returns the Livewire stream number.
 */
export function multicastAddrToStreamNum(multicastAddr: string) {
    const format = streamFormatFromMulticastAddr(multicastAddr);
    const formatBaseIp = streamFormatBaseIp(format);
    const formatBaseIpDecimal = ipToDecimal(formatBaseIp);
    
    const multicastAddrDecimal = ipToDecimal(multicastAddr);
    
    return multicastAddrDecimal - formatBaseIpDecimal;
}

/**
 * Takes a Livewire multicast format and returns the multicast base IP address.
 */
export function streamFormatBaseIp(format: StreamFormat) {
    switch (format) {
        case "standard":
        case "livestream":
            return "239.192.0.0";
        case "backfeed_standard":
            return "239.193.0.0";
        case "backfeed_livestream":
            return "239.195.0.0";
        case "surround":
            return "239.196.0.0";
        default:
            throw Error("Invalid format");
    }
}

/**
 * Takes a Livewire multicast IP address and returns the Livewire format.
 */
export function streamFormatFromMulticastAddr(ipAddress: string) {
    const addressSegments = ipAddress.split('.');
    const formatSegment = Number(addressSegments[1]);
    
    if (formatSegment === 192) {
        // We can't be sure if this is a standard stream or livestream
        return StreamFormat.Standard;
    } else if (formatSegment === 193) {
        return StreamFormat.BackfeedStandard;
    } else if (formatSegment === 195) {
        return StreamFormat.BackfeedLivestream;
    } else if (formatSegment === 196) {
        return StreamFormat.Surround;
    } else {
        throw Error("Unknown format");
    }
}
    
/**
 * Takes a standard dotted-quad IP Address and returns it as an integer.
 * https://gist.github.com/jppommet/5708697
 */
export function ipToDecimal(ip: string) {
    return ip.split('.').reduce(function(ipInt, octet) { return (ipInt<<8) + parseInt(octet, 10)}, 0) >>> 0;
}

/**
 * Takes a integer-based IP Address and returns it as the standard dotted-quad format.
 * https://gist.github.com/jppommet/5708697
 */
export function decimalToIp(ipInt: number) {
    return ( (ipInt>>>24) +'.' + (ipInt>>16 & 255) +'.' + (ipInt>>8 & 255) +'.' + (ipInt & 255) );
}
