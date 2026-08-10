export namespace bridge {
	
	export class Entry {
	    atMs: number;
	    kind: string;
	    detail: string;
	    ok: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Entry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.atMs = source["atMs"];
	        this.kind = source["kind"];
	        this.detail = source["detail"];
	        this.ok = source["ok"];
	    }
	}
	
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

