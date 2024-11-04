const CryptoJS = require('crypto-js');

/**
 * Dependencies
 */
var net        = require('net');
var mes        = require('./message');
var secretKey  = "64df901bab326cd3215f381da1f960d5f279b4d62442981dff7d12725f55dfa0";

// Function to encrypt a message
function encrypt(message) {
	 const encrypted = CryptoJS.AES.encrypt(message, secretKey).toString();
	 return Buffer.from(encrypted);
}

// Function to decrypt a message
function decrypt(message) {
	const bytes = CryptoJS.AES.decrypt(message, secretKey);
	return bytes.toString(CryptoJS.enc.Utf8);
}

/**
 * Constructor
 */
var Proxy = function Constructor(ws) {
	const to = ws.upgradeReq.url.substr(1);
	this._tcp;
	this._from = ws.upgradeReq.connection.remoteAddress;
	this._to   = Buffer.from(to, 'base64').toString();
	this._ws   = ws;

	// Bind data
	this._ws.on('message', this.clientData.bind(this) );
	this._ws.on('close', this.close.bind(this) );
	this._ws.on('error', (error) => {
		console.log(error);
	});

	// Initialize proxy
	var args = this._to.split(':');

	// Connect to server
	mes.info("Requested connection from '%s' to '%s' [ACCEPTED].", this._from, this._to);
	this._tcp = net.connect( args[1], args[0] );

	// Disable nagle algorithm
	this._tcp.setTimeout(0)
	this._tcp.setNoDelay(true)

	this._tcp.on('data', this.serverData.bind(this) );
	this._tcp.on('close', this.close.bind(this) );
	this._tcp.on('error', function(error) {
		console.log(error);
	});
	
	this._tcp.on('connect', this.connectAccept.bind(this) );
}


/**
 * OnClientData
 * Client -> Server
 */
Proxy.prototype.clientData = function OnServerData(data) {
	if (!this._tcp) {
		// wth ? Not initialized yet ?
		return;
	}

	try {
		const msg = decrypt(data.toString());
		this._tcp.write(msg);
	}
	catch(e) {}
}


/**
 * OnServerData
 * Server -> Client
 */
Proxy.prototype.serverData = function OnClientData(data) {
	let msg = encrypt(data.toString());
	this._ws.send(msg, function(error){
		/*
		if (error !== null) {
			OnClose();
		}
		*/
	});
}


/**
 * OnClose
 * Clean up events/sockets
 */
Proxy.prototype.close = function OnClose() {
	if (this._tcp) {
		// mes.info("Connection closed from '%s'.", this._to);

		this._tcp.removeListener('close', this.close.bind(this) );
		this._tcp.removeListener('error', this.close.bind(this) );
		this._tcp.removeListener('data',  this.serverData.bind(this) );
		this._tcp.end();
	}

	if (this._ws) {
		// mes.info("Connection closed from '%s'.", this._from);

		this._ws.removeListener('close',   this.close.bind(this) );
		this._ws.removeListener('error',   this.close.bind(this) );
		this._ws.removeListener('message', this.clientData.bind(this) );
		this._ws.close();
	}
}


/**
 * On server accepts connection
 */
Proxy.prototype.connectAccept = function OnConnectAccept() {
	mes.status("Connection accepted from '%s'.", this._to);
}

/**
 * Exports
 */
module.exports = Proxy;
