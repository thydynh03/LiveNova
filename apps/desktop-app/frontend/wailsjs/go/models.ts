export namespace bridge {
	
	export class Status {
	    is_running: boolean;
	    port: number;
	    session_token: string;
	    connected_clients: number;
	
	    static createFrom(source: any = {}) {
	        return new Status(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.is_running = source["is_running"];
	        this.port = source["port"];
	        this.session_token = source["session_token"];
	        this.connected_clients = source["connected_clients"];
	    }
	}

}

