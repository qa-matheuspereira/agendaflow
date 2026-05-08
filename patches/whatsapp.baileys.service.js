"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaileysStartupService = void 0;
const ffmpeg_1 = __importDefault(require("@ffmpeg-installer/ffmpeg"));
const axios_1 = __importDefault(require("axios"));
const baileys_1 = __importStar(require("baileys"));
const child_process_1 = require("child_process");
const class_validator_1 = require("class-validator");
const fs_1 = __importStar(require("fs"));
const long_1 = __importDefault(require("long"));
const node_cache_1 = __importDefault(require("node-cache"));
const node_mime_types_1 = require("node-mime-types");
const os_1 = require("os");
const path_1 = require("path");
const pino_1 = __importDefault(require("pino"));
const qrcode_1 = __importDefault(require("qrcode"));
const qrcode_terminal_1 = __importDefault(require("qrcode-terminal"));
const sharp_1 = __importDefault(require("sharp"));
const cacheengine_1 = require("../../../cache/cacheengine");
const env_config_1 = require("../../../config/env.config");
const path_config_1 = require("../../../config/path.config");
const exceptions_1 = require("../../../exceptions");
const db_connect_1 = require("../../../libs/db.connect");
const makeProxyAgent_1 = require("../../../utils/makeProxyAgent");
const use_multi_file_auth_state_db_1 = require("../../../utils/use-multi-file-auth-state-db");
const use_multi_file_auth_state_provider_files_1 = require("../../../utils/use-multi-file-auth-state-provider-files");
const use_multi_file_auth_state_redis_db_1 = require("../../../utils/use-multi-file-auth-state-redis-db");
const chat_dto_1 = require("../../dto/chat.dto");
const chatwoot_import_helper_1 = require("../../integrations/chatwoot/utils/chatwoot-import-helper");
const server_module_1 = require("../../server.module");
const wa_types_1 = require("../../types/wa.types");
const cache_service_1 = require("./../cache.service");
const channel_service_1 = require("./../channel.service");
const useVoiceCallsBaileys_1 = require("./voiceCalls/useVoiceCallsBaileys");
const groupMetadataCache = new cache_service_1.CacheService(new cacheengine_1.CacheEngine(env_config_1.configService, 'groups').getEngine());
class BaileysStartupService extends channel_service_1.ChannelStartupService {
    constructor(configService, eventEmitter, repository, cache, chatwootCache, baileysCache, providerFiles) {
        super(configService, eventEmitter, repository, chatwootCache);
        this.configService = configService;
        this.eventEmitter = eventEmitter;
        this.repository = repository;
        this.cache = cache;
        this.chatwootCache = chatwootCache;
        this.baileysCache = baileysCache;
        this.providerFiles = providerFiles;
        this.msgRetryCounterCache = new node_cache_1.default();
        this.userDevicesCache = new node_cache_1.default();
        this.endSession = false;
        this.logBaileys = this.configService.get('LOG').BAILEYS;
        this.stateConnection = { state: 'close' };
        this.chatHandle = {
            'chats.upsert': (chats, database) => { var _a, chats_1, chats_1_1; return __awaiter(this, void 0, void 0, function* () {
                var _b, e_1, _c, _d;
                this.logger.verbose('Event received: chats.upsert');
                this.logger.verbose('Finding chats in database');
                const chatsRepository = yield this.repository.chat.find({
                    where: { owner: this.instance.name },
                });
                this.logger.verbose('Verifying if chats exists in database to insert');
                const chatsRaw = [];
                try {
                    for (_a = true, chats_1 = __asyncValues(chats); chats_1_1 = yield chats_1.next(), _b = chats_1_1.done, !_b;) {
                        _d = chats_1_1.value;
                        _a = false;
                        try {
                            const chat = _d;
                            if (chatsRepository.find((cr) => cr.id === chat.id)) {
                                continue;
                            }
                            chatsRaw.push({ id: chat.id, owner: this.instance.wuid });
                        }
                        finally {
                            _a = true;
                        }
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (!_a && !_b && (_c = chats_1.return)) yield _c.call(chats_1);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
                this.logger.verbose('Sending data to webhook in event CHATS_UPSERT');
                this.sendDataWebhook(wa_types_1.Events.CHATS_UPSERT, chatsRaw);
                this.logger.verbose('Inserting chats in database');
                this.repository.chat.insert(chatsRaw, this.instance.name, database.SAVE_DATA.CHATS);
            }); },
            'chats.update': (chats) => __awaiter(this, void 0, void 0, function* () {
                this.logger.verbose('Event received: chats.update');
                const chatsRaw = chats.map((chat) => {
                    return { id: chat.id, owner: this.instance.wuid };
                });
                this.logger.verbose('Sending data to webhook in event CHATS_UPDATE');
                this.sendDataWebhook(wa_types_1.Events.CHATS_UPDATE, chatsRaw);
            }),
            'chats.delete': (chats) => __awaiter(this, void 0, void 0, function* () {
                this.logger.verbose('Event received: chats.delete');
                this.logger.verbose('Deleting chats in database');
                chats.forEach((chat) => __awaiter(this, void 0, void 0, function* () {
                    return yield this.repository.chat.delete({
                        where: { owner: this.instance.name, id: chat },
                    });
                }));
                this.logger.verbose('Sending data to webhook in event CHATS_DELETE');
                this.sendDataWebhook(wa_types_1.Events.CHATS_DELETE, [...chats]);
            }),
        };
        this.contactHandle = {
            'contacts.upsert': (contacts, database) => { var _a, contacts_1, contacts_1_1; return __awaiter(this, void 0, void 0, function* () {
                var _b, e_2, _c, _d;
                try {
                    this.logger.verbose('Event received: contacts.upsert');
                    this.logger.verbose('Finding contacts in database');
                    const contactsRepository = new Set((yield this.repository.contact.find({
                        select: { id: 1, _id: 0 },
                        where: { owner: this.instance.name },
                    })).map((contact) => contact.id));
                    this.logger.verbose('Verifying if contacts exists in database to insert');
                    let contactsRaw = [];
                    for (const contact of contacts) {
                        if (contactsRepository.has(contact.id)) {
                            continue;
                        }
                        contactsRaw.push({
                            id: contact.id,
                            pushName: (contact === null || contact === void 0 ? void 0 : contact.name) || (contact === null || contact === void 0 ? void 0 : contact.verifiedName) || contact.id.split('@')[0],
                            profilePictureUrl: null,
                            owner: this.instance.name,
                        });
                    }
                    this.logger.verbose('Sending data to webhook in event CONTACTS_UPSERT');
                    if (contactsRaw.length > 0)
                        this.sendDataWebhook(wa_types_1.Events.CONTACTS_UPSERT, contactsRaw);
                    this.logger.verbose('Inserting contacts in database');
                    this.repository.contact.insert(contactsRaw, this.instance.name, database.SAVE_DATA.CONTACTS);
                    if (this.localChatwoot.enabled && this.localChatwoot.import_contacts && contactsRaw.length) {
                        this.chatwootService.addHistoryContacts({ instanceName: this.instance.name }, contactsRaw);
                        chatwoot_import_helper_1.chatwootImport.importHistoryContacts({ instanceName: this.instance.name }, this.localChatwoot);
                    }
                    contactsRaw = [];
                    try {
                        for (_a = true, contacts_1 = __asyncValues(contacts); contacts_1_1 = yield contacts_1.next(), _b = contacts_1_1.done, !_b;) {
                            _d = contacts_1_1.value;
                            _a = false;
                            try {
                                const contact = _d;
                                contactsRaw.push({
                                    id: contact.id,
                                    pushName: (contact === null || contact === void 0 ? void 0 : contact.name) || (contact === null || contact === void 0 ? void 0 : contact.verifiedName) || contact.id.split('@')[0],
                                    profilePictureUrl: (yield this.profilePicture(contact.id)).profilePictureUrl,
                                    owner: this.instance.name,
                                });
                            }
                            finally {
                                _a = true;
                            }
                        }
                    }
                    catch (e_2_1) { e_2 = { error: e_2_1 }; }
                    finally {
                        try {
                            if (!_a && !_b && (_c = contacts_1.return)) yield _c.call(contacts_1);
                        }
                        finally { if (e_2) throw e_2.error; }
                    }
                    this.logger.verbose('Sending data to webhook in event CONTACTS_UPDATE');
                    if (contactsRaw.length > 0)
                        this.sendDataWebhook(wa_types_1.Events.CONTACTS_UPSERT, contactsRaw);
                    this.logger.verbose('Updating contacts in database');
                    this.repository.contact.update(contactsRaw, this.instance.name, database.SAVE_DATA.CONTACTS);
                }
                catch (error) {
                    this.logger.error(error);
                }
            }); },
            'contacts.update': (contacts, database) => { var _a, contacts_2, contacts_2_1; return __awaiter(this, void 0, void 0, function* () {
                var _b, e_3, _c, _d;
                var _e;
                this.logger.verbose('Event received: contacts.update');
                this.logger.verbose('Verifying if contacts exists in database to update');
                const contactsRaw = [];
                try {
                    for (_a = true, contacts_2 = __asyncValues(contacts); contacts_2_1 = yield contacts_2.next(), _b = contacts_2_1.done, !_b;) {
                        _d = contacts_2_1.value;
                        _a = false;
                        try {
                            const contact = _d;
                            contactsRaw.push({
                                id: contact.id,
                                pushName: (_e = contact === null || contact === void 0 ? void 0 : contact.name) !== null && _e !== void 0 ? _e : contact === null || contact === void 0 ? void 0 : contact.verifiedName,
                                profilePictureUrl: (yield this.profilePicture(contact.id)).profilePictureUrl,
                                owner: this.instance.name,
                            });
                        }
                        finally {
                            _a = true;
                        }
                    }
                }
                catch (e_3_1) { e_3 = { error: e_3_1 }; }
                finally {
                    try {
                        if (!_a && !_b && (_c = contacts_2.return)) yield _c.call(contacts_2);
                    }
                    finally { if (e_3) throw e_3.error; }
                }
                this.logger.verbose('Sending data to webhook in event CONTACTS_UPDATE');
                this.sendDataWebhook(wa_types_1.Events.CONTACTS_UPDATE, contactsRaw);
                this.logger.verbose('Updating contacts in database');
                this.repository.contact.update(contactsRaw, this.instance.name, database.SAVE_DATA.CONTACTS);
            }); },
        };
        this.messageHandle = {
            'messaging-history.set': ({ messages, chats, contacts, }, database) => __awaiter(this, void 0, void 0, function* () {
                var _a, _b;
                try {
                    this.logger.verbose('Event received: messaging-history.set');
                    const instance = { instanceName: this.instance.name };
                    const daysLimitToImport = this.localChatwoot.enabled ? this.localChatwoot.days_limit_import_messages : 1000;
                    this.logger.verbose(`Param days limit import messages is: ${daysLimitToImport}`);
                    const date = new Date();
                    const timestampLimitToImport = new Date(date.setDate(date.getDate() - daysLimitToImport)).getTime() / 1000;
                    const maxBatchTimestamp = Math.max(...messages.map((message) => message.messageTimestamp));
                    const processBatch = maxBatchTimestamp >= timestampLimitToImport;
                    if (!processBatch) {
                        this.logger.verbose('Batch ignored by maxTimestamp in this batch');
                        return;
                    }
                    const chatsRaw = [];
                    const chatsRepository = new Set((yield this.repository.chat.find({
                        select: { id: 1, _id: 0 },
                        where: { owner: this.instance.name },
                    })).map((chat) => chat.id));
                    for (const chat of chats) {
                        if (chatsRepository.has(chat.id)) {
                            continue;
                        }
                        chatsRaw.push({
                            id: chat.id,
                            owner: this.instance.name,
                            lastMsgTimestamp: chat.lastMessageRecvTimestamp,
                        });
                    }
                    this.logger.verbose('Sending data to webhook in event CHATS_SET');
                    this.sendDataWebhook(wa_types_1.Events.CHATS_SET, chatsRaw);
                    this.logger.verbose('Inserting chats in database');
                    this.repository.chat.insert(chatsRaw, this.instance.name, database.SAVE_DATA.CHATS);
                    const messagesRaw = [];
                    const messagesRepository = new Set((_a = chatwoot_import_helper_1.chatwootImport.getRepositoryMessagesCache(instance)) !== null && _a !== void 0 ? _a : (yield this.repository.message.find({
                        select: { key: { id: 1 }, _id: 0 },
                        where: { owner: this.instance.name },
                    })).map((message) => message.key.id));
                    if (chatwoot_import_helper_1.chatwootImport.getRepositoryMessagesCache(instance) === null) {
                        chatwoot_import_helper_1.chatwootImport.setRepositoryMessagesCache(instance, messagesRepository);
                    }
                    for (const m of messages) {
                        if (!m.message || !m.key || !m.messageTimestamp) {
                            continue;
                        }
                        if (long_1.default.isLong(m === null || m === void 0 ? void 0 : m.messageTimestamp)) {
                            m.messageTimestamp = (_b = m.messageTimestamp) === null || _b === void 0 ? void 0 : _b.toNumber();
                        }
                        if (m.messageTimestamp <= timestampLimitToImport) {
                            continue;
                        }
                        if (messagesRepository.has(m.key.id)) {
                            continue;
                        }
                        const status = {
                            0: 'ERROR',
                            1: 'PENDING',
                            2: 'SERVER_ACK',
                            3: 'DELIVERY_ACK',
                            4: 'READ',
                            5: 'PLAYED',
                        };
                        messagesRaw.push({
                            key: m.key,
                            pushName: m.pushName || m.key.remoteJid.split('@')[0],
                            participant: m.participant,
                            message: Object.assign({}, m.message),
                            messageType: (0, baileys_1.getContentType)(m.message),
                            messageTimestamp: m.messageTimestamp,
                            owner: this.instance.name,
                            status: m.status ? status[m.status] : null,
                        });
                    }
                    this.logger.verbose('Sending data to webhook in event MESSAGES_SET');
                    this.sendDataWebhook(wa_types_1.Events.MESSAGES_SET, [...messagesRaw]);
                    this.logger.verbose('Inserting messages in database');
                    yield this.repository.message.insert(messagesRaw, this.instance.name, database.SAVE_DATA.NEW_MESSAGE);
                    if (this.localChatwoot.enabled && this.localChatwoot.import_messages && messagesRaw.length > 0) {
                        this.chatwootService.addHistoryMessages(instance, messagesRaw.filter((msg) => { var _a; return !chatwoot_import_helper_1.chatwootImport.isIgnorePhoneNumber((_a = msg.key) === null || _a === void 0 ? void 0 : _a.remoteJid); }));
                    }
                    yield this.contactHandle['contacts.upsert'](contacts
                        .filter((c) => !!c.notify || !!c.name)
                        .map((c) => {
                        var _a;
                        return ({
                            id: c.id,
                            name: (_a = c.name) !== null && _a !== void 0 ? _a : c.notify,
                        });
                    }), database);
                    contacts = undefined;
                    messages = undefined;
                    chats = undefined;
                }
                catch (error) {
                    this.logger.error(error);
                }
            }),
            'messages.upsert': ({ messages, type, }, database, settings) => __awaiter(this, void 0, void 0, function* () {
                var _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v;
                try {
                    this.logger.verbose('Event received: messages.upsert');
                    for (const received of messages) {
                        if (this.localChatwoot.enabled &&
                            (((_d = (_c = received.message) === null || _c === void 0 ? void 0 : _c.protocolMessage) === null || _d === void 0 ? void 0 : _d.editedMessage) || ((_f = (_e = received.message) === null || _e === void 0 ? void 0 : _e.editedMessage) === null || _f === void 0 ? void 0 : _f.message))) {
                            const editedMessage = ((_g = received.message) === null || _g === void 0 ? void 0 : _g.protocolMessage) || ((_k = (_j = (_h = received.message) === null || _h === void 0 ? void 0 : _h.editedMessage) === null || _j === void 0 ? void 0 : _j.message) === null || _k === void 0 ? void 0 : _k.protocolMessage);
                            if (editedMessage) {
                                this.chatwootService.eventWhatsapp('messages.edit', { instanceName: this.instance.name }, editedMessage);
                            }
                        }
                        if (received.messageStubParameters && received.messageStubParameters[0] === 'Message absent from node') {
                            this.logger.info('Recovering message lost');
                            yield this.baileysCache.set(received.key.id, received);
                            continue;
                        }
                        const retryCache = (yield this.baileysCache.get(received.key.id)) || null;
                        if (retryCache) {
                            this.logger.info('Recovered message lost');
                            yield this.baileysCache.delete(received.key.id);
                        }
                        if ((type !== 'notify' && type !== 'append') ||
                            ((_l = received.message) === null || _l === void 0 ? void 0 : _l.protocolMessage) ||
                            ((_m = received.message) === null || _m === void 0 ? void 0 : _m.pollUpdateMessage) ||
                            !(received === null || received === void 0 ? void 0 : received.message)) {
                            this.logger.verbose('message rejected');
                            return;
                        }
                        if (long_1.default.isLong(received.messageTimestamp)) {
                            received.messageTimestamp = (_o = received.messageTimestamp) === null || _o === void 0 ? void 0 : _o.toNumber();
                        }
                        if ((settings === null || settings === void 0 ? void 0 : settings.groups_ignore) && received.key.remoteJid.includes('@g.us')) {
                            this.logger.verbose('group ignored');
                            return;
                        }
                        let messageRaw;
                        const isMedia = ((_p = received === null || received === void 0 ? void 0 : received.message) === null || _p === void 0 ? void 0 : _p.imageMessage) ||
                            ((_q = received === null || received === void 0 ? void 0 : received.message) === null || _q === void 0 ? void 0 : _q.videoMessage) ||
                            ((_r = received === null || received === void 0 ? void 0 : received.message) === null || _r === void 0 ? void 0 : _r.stickerMessage) ||
                            ((_s = received === null || received === void 0 ? void 0 : received.message) === null || _s === void 0 ? void 0 : _s.documentMessage) ||
                            ((_t = received === null || received === void 0 ? void 0 : received.message) === null || _t === void 0 ? void 0 : _t.documentWithCaptionMessage) ||
                            ((_u = received === null || received === void 0 ? void 0 : received.message) === null || _u === void 0 ? void 0 : _u.audioMessage);
                        const contentMsg = received === null || received === void 0 ? void 0 : received.message[(0, baileys_1.getContentType)(received.message)];
                        if ((this.localWebhook.webhook_base64 === true ||
                            (this.configService.get('WEBSOCKET').GLOBAL_EVENTS === true &&
                                this.configService.get('WEBSOCKET').ENABLED === true)) &&
                            isMedia) {
                            const buffer = yield (0, baileys_1.downloadMediaMessage)({ key: received.key, message: received === null || received === void 0 ? void 0 : received.message }, 'buffer', {}, {
                                logger: (0, pino_1.default)({ level: 'error' }),
                                reuploadRequest: this.client.updateMediaMessage,
                            });
                            messageRaw = {
                                key: received.key,
                                pushName: received.pushName,
                                message: Object.assign(Object.assign({}, received.message), { base64: buffer ? buffer.toString('base64') : undefined }),
                                contextInfo: contentMsg === null || contentMsg === void 0 ? void 0 : contentMsg.contextInfo,
                                messageType: (0, baileys_1.getContentType)(received.message),
                                messageTimestamp: received.messageTimestamp,
                                owner: this.instance.name,
                                source: (0, baileys_1.getDevice)(received.key.id),
                            };
                        }
                        else {
                            messageRaw = {
                                key: received.key,
                                pushName: received.pushName,
                                message: Object.assign({}, received.message),
                                contextInfo: contentMsg === null || contentMsg === void 0 ? void 0 : contentMsg.contextInfo,
                                messageType: (0, baileys_1.getContentType)(received.message),
                                messageTimestamp: received.messageTimestamp,
                                owner: this.instance.name,
                                source: (0, baileys_1.getDevice)(received.key.id),
                            };
                        }
                        if (this.localSettings.read_messages && received.key.id !== 'status@broadcast') {
                            yield this.client.readMessages([received.key]);
                        }
                        if (this.localSettings.read_status && received.key.id === 'status@broadcast') {
                            yield this.client.readMessages([received.key]);
                        }
                        this.logger.log(messageRaw);
                        this.logger.verbose('Sending data to webhook in event MESSAGES_UPSERT');
                        this.sendDataWebhook(wa_types_1.Events.MESSAGES_UPSERT, messageRaw);
                        if (this.localChatwoot.enabled && !received.key.id.includes('@broadcast')) {
                            const chatwootSentMessage = yield this.chatwootService.eventWhatsapp(wa_types_1.Events.MESSAGES_UPSERT, { instanceName: this.instance.name }, messageRaw);
                            if (chatwootSentMessage === null || chatwootSentMessage === void 0 ? void 0 : chatwootSentMessage.id) {
                                messageRaw.chatwoot = {
                                    messageId: chatwootSentMessage.id,
                                    inboxId: chatwootSentMessage.inbox_id,
                                    conversationId: chatwootSentMessage.conversation_id,
                                };
                            }
                        }
                        const typebotSessionRemoteJid = (_v = this.localTypebot.sessions) === null || _v === void 0 ? void 0 : _v.find((session) => session.remoteJid === received.key.remoteJid);
                        if ((this.localTypebot.enabled && type === 'notify') || typebotSessionRemoteJid) {
                            if (!(this.localTypebot.listening_from_me === false && messageRaw.key.fromMe === true)) {
                                if (messageRaw.messageType !== 'reactionMessage')
                                    yield this.typebotService.sendTypebot({ instanceName: this.instance.name }, messageRaw.key.remoteJid, messageRaw);
                            }
                        }
                        if (this.localChamaai.enabled && messageRaw.key.fromMe === false && type === 'notify') {
                            yield this.chamaaiService.sendChamaai({ instanceName: this.instance.name }, messageRaw.key.remoteJid, messageRaw);
                        }
                        this.logger.verbose('Inserting message in database');
                        yield this.repository.message.insert([messageRaw], this.instance.name, database.SAVE_DATA.NEW_MESSAGE);
                        this.logger.verbose('Verifying contact from message');
                        const contact = yield this.repository.contact.find({
                            where: { owner: this.instance.name, id: received.key.remoteJid },
                        });
                        const contactRaw = {
                            id: received.key.remoteJid,
                            pushName: received.pushName,
                            profilePictureUrl: (yield this.profilePicture(received.key.remoteJid)).profilePictureUrl,
                            owner: this.instance.name,
                        };
                        if (contactRaw.id === 'status@broadcast') {
                            this.logger.verbose('Contact is status@broadcast');
                            return;
                        }
                        if (contact === null || contact === void 0 ? void 0 : contact.length) {
                            this.logger.verbose('Contact found in database');
                            const contactRaw = {
                                id: received.key.remoteJid,
                                pushName: contact[0].pushName,
                                profilePictureUrl: (yield this.profilePicture(received.key.remoteJid)).profilePictureUrl,
                                owner: this.instance.name,
                            };
                            this.logger.verbose('Sending data to webhook in event CONTACTS_UPDATE');
                            this.sendDataWebhook(wa_types_1.Events.CONTACTS_UPDATE, contactRaw);
                            if (this.localChatwoot.enabled) {
                                yield this.chatwootService.eventWhatsapp(wa_types_1.Events.CONTACTS_UPDATE, { instanceName: this.instance.name }, contactRaw);
                            }
                            this.logger.verbose('Updating contact in database');
                            yield this.repository.contact.update([contactRaw], this.instance.name, database.SAVE_DATA.CONTACTS);
                            return;
                        }
                        this.logger.verbose('Contact not found in database');
                        this.logger.verbose('Sending data to webhook in event CONTACTS_UPSERT');
                        this.sendDataWebhook(wa_types_1.Events.CONTACTS_UPSERT, contactRaw);
                        this.logger.verbose('Inserting contact in database');
                        this.repository.contact.insert([contactRaw], this.instance.name, database.SAVE_DATA.CONTACTS);
                    }
                }
                catch (error) {
                    this.logger.error(error);
                }
            }),
            'messages.update': (args, database, settings) => { var _a, args_1, args_1_1; return __awaiter(this, void 0, void 0, function* () {
                var _b, e_4, _c, _d;
                var _e;
                this.logger.verbose('Event received: messages.update');
                const status = {
                    0: 'ERROR',
                    1: 'PENDING',
                    2: 'SERVER_ACK',
                    3: 'DELIVERY_ACK',
                    4: 'READ',
                    5: 'PLAYED',
                };
                try {
                    for (_a = true, args_1 = __asyncValues(args); args_1_1 = yield args_1.next(), _b = args_1_1.done, !_b;) {
                        _d = args_1_1.value;
                        _a = false;
                        try {
                            const { key, update } = _d;
                            if ((settings === null || settings === void 0 ? void 0 : settings.groups_ignore) && ((_e = key.remoteJid) === null || _e === void 0 ? void 0 : _e.includes('@g.us'))) {
                                this.logger.verbose('group ignored');
                                return;
                            }
                            if (status[update.status] === 'READ' && key.fromMe) {
                                if (this.localChatwoot.enabled) {
                                    this.chatwootService.eventWhatsapp('messages.read', { instanceName: this.instance.name }, { key: key });
                                }
                            }
                            if (key.remoteJid !== 'status@broadcast') {
                                this.logger.verbose('Message update is valid');
                                let pollUpdates;
                                if (update.pollUpdates) {
                                    this.logger.verbose('Poll update found');
                                    this.logger.verbose('Getting poll message');
                                    const pollCreation = yield this.getMessage(key);
                                    this.logger.verbose(pollCreation);
                                    if (pollCreation) {
                                        this.logger.verbose('Getting aggregate votes in poll message');
                                        pollUpdates = (0, baileys_1.getAggregateVotesInPollMessage)({
                                            message: pollCreation,
                                            pollUpdates: update.pollUpdates,
                                        });
                                    }
                                }
                                if (status[update.status] === 'READ' && !key.fromMe)
                                    return;
                                if (update.message === null && update.status === undefined) {
                                    this.logger.verbose('Message deleted');
                                    this.logger.verbose('Sending data to webhook in event MESSAGE_DELETE');
                                    this.sendDataWebhook(wa_types_1.Events.MESSAGES_DELETE, key);
                                    const message = Object.assign(Object.assign({}, key), { status: 'DELETED', datetime: Date.now(), owner: this.instance.name });
                                    this.logger.verbose(message);
                                    this.logger.verbose('Inserting message in database');
                                    yield this.repository.messageUpdate.insert([message], this.instance.name, database.SAVE_DATA.MESSAGE_UPDATE);
                                    if (this.localChatwoot.enabled) {
                                        this.chatwootService.eventWhatsapp(wa_types_1.Events.MESSAGES_DELETE, { instanceName: this.instance.name }, { key: key });
                                    }
                                    return;
                                }
                                const message = Object.assign(Object.assign({}, key), { status: status[update.status], datetime: Date.now(), owner: this.instance.name, pollUpdates });
                                this.logger.verbose(message);
                                this.logger.verbose('Sending data to webhook in event MESSAGES_UPDATE');
                                this.sendDataWebhook(wa_types_1.Events.MESSAGES_UPDATE, message);
                                this.logger.verbose('Inserting message in database');
                                this.repository.messageUpdate.insert([message], this.instance.name, database.SAVE_DATA.MESSAGE_UPDATE);
                            }
                        }
                        finally {
                            _a = true;
                        }
                    }
                }
                catch (e_4_1) { e_4 = { error: e_4_1 }; }
                finally {
                    try {
                        if (!_a && !_b && (_c = args_1.return)) yield _c.call(args_1);
                    }
                    finally { if (e_4) throw e_4.error; }
                }
            }); },
        };
        this.groupHandler = {
            'groups.upsert': (groupMetadata) => {
                this.logger.verbose('Event received: groups.upsert');
                this.logger.verbose('Sending data to webhook in event GROUPS_UPSERT');
                this.sendDataWebhook(wa_types_1.Events.GROUPS_UPSERT, groupMetadata);
            },
            'groups.update': (groupMetadataUpdate) => {
                this.logger.verbose('Event received: groups.update');
                this.logger.verbose('Sending data to webhook in event GROUPS_UPDATE');
                this.sendDataWebhook(wa_types_1.Events.GROUPS_UPDATE, groupMetadataUpdate);
                groupMetadataUpdate.forEach((group) => {
                    if ((0, baileys_1.isJidGroup)(group.id)) {
                        this.updateGroupMetadataCache(group.id);
                    }
                });
            },
            'group-participants.update': (participantsUpdate) => {
                this.logger.verbose('Event received: group-participants.update');
                this.logger.verbose('Sending data to webhook in event GROUP_PARTICIPANTS_UPDATE');
                this.sendDataWebhook(wa_types_1.Events.GROUP_PARTICIPANTS_UPDATE, participantsUpdate);
            },
        };
        this.labelHandle = {
            [wa_types_1.Events.LABELS_EDIT]: (label, database) => __awaiter(this, void 0, void 0, function* () {
                this.logger.verbose('Event received: labels.edit');
                this.logger.verbose('Finding labels in database');
                const labelsRepository = yield this.repository.labels.find({
                    where: { owner: this.instance.name },
                });
                const savedLabel = labelsRepository.find((l) => l.id === label.id);
                if (label.deleted && savedLabel) {
                    this.logger.verbose('Sending data to webhook in event LABELS_EDIT');
                    yield this.repository.labels.delete({
                        where: { owner: this.instance.name, id: label.id },
                    });
                    this.sendDataWebhook(wa_types_1.Events.LABELS_EDIT, Object.assign(Object.assign({}, label), { instance: this.instance.name }));
                    return;
                }
                const labelName = label.name.replace(/[^\x20-\x7E]/g, '');
                if (!savedLabel || savedLabel.color !== label.color || savedLabel.name !== labelName) {
                    this.logger.verbose('Sending data to webhook in event LABELS_EDIT');
                    yield this.repository.labels.insert({
                        color: label.color,
                        name: labelName,
                        owner: this.instance.name,
                        id: label.id,
                        predefinedId: label.predefinedId,
                    }, this.instance.name, database.SAVE_DATA.LABELS);
                    this.sendDataWebhook(wa_types_1.Events.LABELS_EDIT, Object.assign(Object.assign({}, label), { instance: this.instance.name }));
                }
            }),
            [wa_types_1.Events.LABELS_ASSOCIATION]: (data, database) => __awaiter(this, void 0, void 0, function* () {
                this.logger.verbose('Sending data to webhook in event LABELS_ASSOCIATION');
                if (database.ENABLED && database.SAVE_DATA.CHATS) {
                    const chats = yield this.repository.chat.find({
                        where: {
                            owner: this.instance.name,
                        },
                    });
                    const chat = chats.find((c) => c.id === data.association.chatId);
                    if (chat) {
                        let labels = [...chat.labels];
                        if (data.type === 'remove') {
                            labels = labels.filter((label) => label !== data.association.labelId);
                        }
                        else if (data.type === 'add') {
                            labels = [...labels, data.association.labelId];
                        }
                        yield this.repository.chat.update([{ id: chat.id, owner: this.instance.name, labels }], this.instance.name, database.SAVE_DATA.CHATS);
                    }
                }
                this.sendDataWebhook(wa_types_1.Events.LABELS_ASSOCIATION, {
                    instance: this.instance.name,
                    type: data.type,
                    chatId: data.association.chatId,
                    labelId: data.association.labelId,
                });
            }),
        };
        this.logger.verbose('BaileysStartupService initialized');
        this.cleanStore();
        this.instance.qrcode = { count: 0 };
        this.mobile = false;
        this.recoveringMessages();
        this.forceUpdateGroupMetadataCache();
        this.authStateProvider = new use_multi_file_auth_state_provider_files_1.AuthStateProvider(this.providerFiles);
    }
    recoveringMessages() {
        var _a, _b, _c;
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.info('Recovering messages lost');
            const cacheConf = this.configService.get('CACHE');
            if ((((_a = cacheConf === null || cacheConf === void 0 ? void 0 : cacheConf.REDIS) === null || _a === void 0 ? void 0 : _a.ENABLED) && ((_b = cacheConf === null || cacheConf === void 0 ? void 0 : cacheConf.REDIS) === null || _b === void 0 ? void 0 : _b.URI) !== '') || ((_c = cacheConf === null || cacheConf === void 0 ? void 0 : cacheConf.LOCAL) === null || _c === void 0 ? void 0 : _c.ENABLED)) {
                setInterval(() => __awaiter(this, void 0, void 0, function* () {
                    this.baileysCache.keys().then((keys) => {
                        keys.forEach((key) => __awaiter(this, void 0, void 0, function* () {
                            const message = yield this.baileysCache.get(key.split(':')[2]);
                            if (message.messageStubParameters && message.messageStubParameters[0] === 'Message absent from node') {
                                this.logger.info('Message absent from node, retrying to send, key: ' + key.split(':')[2]);
                                yield this.client.sendMessageAck(JSON.parse(message.messageStubParameters[1], baileys_1.BufferJSON.reviver));
                            }
                        }));
                    });
                }), 30000);
            }
        });
    }
    forceUpdateGroupMetadataCache() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.configService.get('CACHE').REDIS.ENABLED &&
                !this.configService.get('CACHE').LOCAL.ENABLED)
                return;
            setInterval(() => __awaiter(this, void 0, void 0, function* () {
                this.logger.verbose('Forcing update group metadata cache');
                const groups = yield this.fetchAllGroups({ getParticipants: 'false' });
                for (const group of groups) {
                    yield this.updateGroupMetadataCache(group.id);
                }
            }), 3600000);
        });
    }
    get connectionStatus() {
        this.logger.verbose('Getting connection status');
        return this.stateConnection;
    }
    logoutInstance() {
        var _a, _b, _c;
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('logging out instance: ' + this.instanceName);
            yield ((_a = this.client) === null || _a === void 0 ? void 0 : _a.logout('Log out instance: ' + this.instanceName));
            this.logger.verbose('close connection instance: ' + this.instanceName);
            (_c = (_b = this.client) === null || _b === void 0 ? void 0 : _b.ws) === null || _c === void 0 ? void 0 : _c.close();
        });
    }
    getProfileName() {
        var _a, _b, _c, _d, _e, _f, _g;
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Getting profile name');
            let profileName = (_b = (_a = this.client.user) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : (_c = this.client.user) === null || _c === void 0 ? void 0 : _c.verifiedName;
            if (!profileName) {
                this.logger.verbose('Profile name not found, trying to get from database');
                if (this.configService.get('DATABASE').ENABLED) {
                    this.logger.verbose('Database enabled, trying to get from database');
                    const collection = db_connect_1.dbserver
                        .getClient()
                        .db(this.configService.get('DATABASE').CONNECTION.DB_PREFIX_NAME + '-instances')
                        .collection(this.instanceName);
                    const data = yield collection.findOne({ _id: 'creds' });
                    if (data) {
                        this.logger.verbose('Profile name found in database');
                        const creds = JSON.parse(JSON.stringify(data), baileys_1.BufferJSON.reviver);
                        profileName = ((_d = creds.me) === null || _d === void 0 ? void 0 : _d.name) || ((_e = creds.me) === null || _e === void 0 ? void 0 : _e.verifiedName);
                    }
                }
                else if ((0, fs_1.existsSync)((0, path_1.join)(path_config_1.INSTANCE_DIR, this.instanceName, 'creds.json'))) {
                    this.logger.verbose('Profile name found in file');
                    const creds = JSON.parse((0, fs_1.readFileSync)((0, path_1.join)(path_config_1.INSTANCE_DIR, this.instanceName, 'creds.json'), {
                        encoding: 'utf-8',
                    }));
                    profileName = ((_f = creds.me) === null || _f === void 0 ? void 0 : _f.name) || ((_g = creds.me) === null || _g === void 0 ? void 0 : _g.verifiedName);
                }
            }
            this.logger.verbose(`Profile name: ${profileName}`);
            return profileName;
        });
    }
    getProfileStatus() {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Getting profile status');
            const status = yield this.client.fetchStatus(this.instance.wuid);
            this.logger.verbose(`Profile status: ${(_a = status[0]) === null || _a === void 0 ? void 0 : _a.status}`);
            return (_b = status[0]) === null || _b === void 0 ? void 0 : _b.status;
        });
    }
    get profilePictureUrl() {
        this.logger.verbose('Getting profile picture url');
        return this.instance.profilePictureUrl;
    }
    get qrCode() {
        var _a, _b, _c, _d;
        this.logger.verbose('Getting qrcode');
        return {
            pairingCode: (_a = this.instance.qrcode) === null || _a === void 0 ? void 0 : _a.pairingCode,
            code: (_b = this.instance.qrcode) === null || _b === void 0 ? void 0 : _b.code,
            base64: (_c = this.instance.qrcode) === null || _c === void 0 ? void 0 : _c.base64,
            count: (_d = this.instance.qrcode) === null || _d === void 0 ? void 0 : _d.count,
        };
    }
    connectionUpdate({ qr, connection, lastDisconnect }) {
        var _a, _b, _c, _d, _e, _f, _g;
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Connection update');
            if (qr) {
                this.logger.verbose('QR code found');
                if (this.instance.qrcode.count === this.configService.get('QRCODE').LIMIT) {
                    this.logger.verbose('QR code limit reached');
                    this.logger.verbose('Sending data to webhook in event QRCODE_UPDATED');
                    this.sendDataWebhook(wa_types_1.Events.QRCODE_UPDATED, {
                        message: 'QR code limit reached, please login again',
                        statusCode: baileys_1.DisconnectReason.badSession,
                    });
                    if (this.localChatwoot.enabled) {
                        this.chatwootService.eventWhatsapp(wa_types_1.Events.QRCODE_UPDATED, { instanceName: this.instance.name }, {
                            message: 'QR code limit reached, please login again',
                            statusCode: baileys_1.DisconnectReason.badSession,
                        });
                    }
                    this.logger.verbose('Sending data to webhook in event CONNECTION_UPDATE');
                    this.sendDataWebhook(wa_types_1.Events.CONNECTION_UPDATE, {
                        instance: this.instance.name,
                        state: 'refused',
                        statusReason: baileys_1.DisconnectReason.connectionClosed,
                    });
                    this.logger.verbose('endSession defined as true');
                    this.endSession = true;
                    this.logger.verbose('Emmiting event logout.instance');
                    return this.eventEmitter.emit('no.connection', this.instance.name);
                }
                this.logger.verbose('Incrementing QR code count');
                this.instance.qrcode.count++;
                const color = this.configService.get('QRCODE').COLOR;
                const optsQrcode = {
                    margin: 3,
                    scale: 4,
                    errorCorrectionLevel: 'H',
                    color: { light: '#ffffff', dark: color },
                };
                if (this.phoneNumber) {
                    yield (0, baileys_1.delay)(2000);
                    this.instance.qrcode.pairingCode = yield this.client.requestPairingCode(this.phoneNumber);
                }
                else {
                    this.instance.qrcode.pairingCode = null;
                }
                this.logger.verbose('Generating QR code');
                qrcode_1.default.toDataURL(qr, optsQrcode, (error, base64) => {
                    if (error) {
                        this.logger.error('Qrcode generate failed:' + error.toString());
                        return;
                    }
                    this.instance.qrcode.base64 = base64;
                    this.instance.qrcode.code = qr;
                    this.sendDataWebhook(wa_types_1.Events.QRCODE_UPDATED, {
                        qrcode: {
                            instance: this.instance.name,
                            pairingCode: this.instance.qrcode.pairingCode,
                            code: qr,
                            base64,
                        },
                    });
                    if (this.localChatwoot.enabled) {
                        this.chatwootService.eventWhatsapp(wa_types_1.Events.QRCODE_UPDATED, { instanceName: this.instance.name }, {
                            qrcode: {
                                instance: this.instance.name,
                                pairingCode: this.instance.qrcode.pairingCode,
                                code: qr,
                                base64,
                            },
                        });
                    }
                });
                this.logger.verbose('Generating QR code in terminal');
                qrcode_terminal_1.default.generate(qr, { small: true }, (qrcode) => this.logger.log(`\n{ instance: ${this.instance.name} pairingCode: ${this.instance.qrcode.pairingCode}, qrcodeCount: ${this.instance.qrcode.count} }\n` +
                    qrcode));
            }
            if (connection) {
                this.logger.verbose('Connection found');
                this.stateConnection = {
                    state: connection,
                    statusReason: (_c = (_b = (_a = lastDisconnect === null || lastDisconnect === void 0 ? void 0 : lastDisconnect.error) === null || _a === void 0 ? void 0 : _a.output) === null || _b === void 0 ? void 0 : _b.statusCode) !== null && _c !== void 0 ? _c : 200,
                };
            }
            if (connection === 'close') {
                this.logger.verbose('Connection closed');
                const shouldReconnect = ((_e = (_d = lastDisconnect.error) === null || _d === void 0 ? void 0 : _d.output) === null || _e === void 0 ? void 0 : _e.statusCode) !== baileys_1.DisconnectReason.loggedOut;
                if (shouldReconnect) {
                    this.logger.verbose('Reconnecting to whatsapp');
                    yield this.connectToWhatsapp();
                }
                else {
                    this.logger.verbose('Do not reconnect to whatsapp');
                    this.logger.verbose('Sending data to webhook in event STATUS_INSTANCE');
                    this.sendDataWebhook(wa_types_1.Events.STATUS_INSTANCE, {
                        instance: this.instance.name,
                        status: 'closed',
                    });
                    if (this.localChatwoot.enabled) {
                        this.chatwootService.eventWhatsapp(wa_types_1.Events.STATUS_INSTANCE, { instanceName: this.instance.name }, {
                            instance: this.instance.name,
                            status: 'closed',
                        });
                    }
                    this.logger.verbose('Emittin event logout.instance');
                    this.eventEmitter.emit('logout.instance', this.instance.name, 'inner');
                    (_g = (_f = this.client) === null || _f === void 0 ? void 0 : _f.ws) === null || _g === void 0 ? void 0 : _g.close();
                    this.client.end(new Error('Close connection'));
                    this.logger.verbose('Connection closed');
                    this.logger.verbose('Sending data to webhook in event CONNECTION_UPDATE');
                    this.sendDataWebhook(wa_types_1.Events.CONNECTION_UPDATE, Object.assign({ instance: this.instance.name, wuid: this.instance.wuid, profileName: yield this.getProfileName(), profilePictureUrl: this.instance.profilePictureUrl }, this.stateConnection));
                }
            }
            if (connection === 'open') {
                this.logger.verbose('Connection opened');
                this.instance.wuid = this.client.user.id.replace(/:\d+/, '');
                this.instance.profilePictureUrl = (yield this.profilePicture(this.instance.wuid)).profilePictureUrl;
                const formattedWuid = this.instance.wuid.split('@')[0].padEnd(30, ' ');
                const formattedName = this.instance.name;
                this.logger.info(`
        ┌──────────────────────────────┐
        │    CONNECTED TO WHATSAPP     │
        └──────────────────────────────┘`.replace(/^ +/gm, '  '));
                this.logger.info(`
        wuid: ${formattedWuid}
        name: ${formattedName}
      `);
                if (this.localChatwoot.enabled) {
                    this.chatwootService.eventWhatsapp(wa_types_1.Events.CONNECTION_UPDATE, { instanceName: this.instance.name }, {
                        instance: this.instance.name,
                        status: 'open',
                        wuid: this.instance.wuid,
                        profileName: yield this.getProfileName(),
                        profilePictureUrl: this.instance.profilePictureUrl,
                    });
                }
                this.logger.verbose('Sending data to webhook in event CONNECTION_UPDATE');
                this.sendDataWebhook(wa_types_1.Events.CONNECTION_UPDATE, Object.assign({ instance: this.instance.name, wuid: this.instance.wuid, profileName: yield this.getProfileName(), profilePictureUrl: this.instance.profilePictureUrl }, this.stateConnection));
            }
            if (connection === 'connecting') {
                if (this.mobile)
                    this.sendMobileCode();
                this.logger.verbose('Sending data to webhook in event CONNECTION_UPDATE');
                this.sendDataWebhook(wa_types_1.Events.CONNECTION_UPDATE, Object.assign({ instance: this.instance.name, wuid: this.instance.wuid, profileName: yield this.getProfileName(), profilePictureUrl: this.instance.profilePictureUrl }, this.stateConnection));
            }
        });
    }
    getMessage(key, full = false) {
        var _a, _b, _c, _d;
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Getting message with key: ' + JSON.stringify(key));
            try {
                const webMessageInfo = (yield this.repository.message.find({
                    where: { owner: this.instance.name, key: { id: key.id } },
                }));
                if (full) {
                    this.logger.verbose('Returning full message');
                    return webMessageInfo[0];
                }
                if ((_a = webMessageInfo[0].message) === null || _a === void 0 ? void 0 : _a.pollCreationMessage) {
                    this.logger.verbose('Returning poll message');
                    const messageSecretBase64 = (_c = (_b = webMessageInfo[0].message) === null || _b === void 0 ? void 0 : _b.messageContextInfo) === null || _c === void 0 ? void 0 : _c.messageSecret;
                    if (typeof messageSecretBase64 === 'string') {
                        const messageSecret = Buffer.from(messageSecretBase64, 'base64');
                        const msg = {
                            messageContextInfo: {
                                messageSecret,
                            },
                            pollCreationMessage: (_d = webMessageInfo[0].message) === null || _d === void 0 ? void 0 : _d.pollCreationMessage,
                        };
                        return msg;
                    }
                }
                this.logger.verbose('Returning message');
                return webMessageInfo[0].message;
            }
            catch (error) {
                return { conversation: '' };
            }
        });
    }
    defineAuthState() {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Defining auth state');
            const db = this.configService.get('DATABASE');
            const cache = this.configService.get('CACHE');
            const provider = this.configService.get('PROVIDER');
            if (provider === null || provider === void 0 ? void 0 : provider.ENABLED) {
                return yield this.authStateProvider.authStateProvider(this.instance.name);
            }
            if ((cache === null || cache === void 0 ? void 0 : cache.REDIS.ENABLED) && (cache === null || cache === void 0 ? void 0 : cache.REDIS.SAVE_INSTANCES)) {
                this.logger.info('Redis enabled');
                return yield (0, use_multi_file_auth_state_redis_db_1.useMultiFileAuthStateRedisDb)(this.instance.name, this.cache);
            }
            if (db.SAVE_DATA.INSTANCE && db.ENABLED) {
                this.logger.verbose('Database enabled');
                return yield (0, use_multi_file_auth_state_db_1.useMultiFileAuthStateDb)(this.instance.name);
            }
            this.logger.verbose('Store file enabled');
            return yield (0, baileys_1.useMultiFileAuthState)((0, path_1.join)(path_config_1.INSTANCE_DIR, this.instance.name));
        });
    }
    createClient(number, mobile) {
        var _a, _b, _c, _d, _e;
        return __awaiter(this, void 0, void 0, function* () {
            this.instance.authState = yield this.defineAuthState();
            if (!mobile) {
                this.mobile = false;
            }
            else {
                this.mobile = mobile;
            }
            const session = this.configService.get('CONFIG_SESSION_PHONE');
            let browserOptions = {};
            if (number || this.phoneNumber) {
                this.phoneNumber = number;
                this.logger.info(`Phone number: ${number}`);
            }
            else {
                const browser = [session.CLIENT, session.NAME, (0, os_1.release)()];
                browserOptions = { browser };
                this.logger.info(`Browser: ${browser}`);
            }
            let version;
            let log;
            if (session.VERSION) {
                version = session.VERSION.split(',');
                log = `Baileys version env: ${version}`;
            }
            else {
                const baileysVersion = yield (0, baileys_1.fetchLatestBaileysVersion)();
                version = baileysVersion.version;
                log = `Baileys version: ${version}`;
            }
            this.logger.info(log);
            let options;
            if (this.localProxy.enabled) {
                this.logger.info('Proxy enabled: ' + ((_a = this.localProxy.proxy) === null || _a === void 0 ? void 0 : _a.host));
                if ((_d = (_c = (_b = this.localProxy) === null || _b === void 0 ? void 0 : _b.proxy) === null || _c === void 0 ? void 0 : _c.host) === null || _d === void 0 ? void 0 : _d.includes('proxyscrape')) {
                    try {
                        const response = yield axios_1.default.get((_e = this.localProxy.proxy) === null || _e === void 0 ? void 0 : _e.host);
                        const text = response.data;
                        const proxyUrls = text.split('\r\n');
                        const rand = Math.floor(Math.random() * Math.floor(proxyUrls.length));
                        const proxyUrl = 'http://' + proxyUrls[rand];
                        options = {
                            agent: (0, makeProxyAgent_1.makeProxyAgent)(proxyUrl),
                            fetchAgent: (0, makeProxyAgent_1.makeProxyAgent)(proxyUrl),
                        };
                    }
                    catch (error) {
                        this.localProxy.enabled = false;
                    }
                }
                else {
                    options = {
                        agent: (0, makeProxyAgent_1.makeProxyAgent)(this.localProxy.proxy),
                        fetchAgent: (0, makeProxyAgent_1.makeProxyAgent)(this.localProxy.proxy),
                    };
                }
            }
            const socketConfig = Object.assign(Object.assign(Object.assign(Object.assign({}, options), { auth: {
                    creds: this.instance.authState.state.creds,
                    keys: (0, baileys_1.makeCacheableSignalKeyStore)(this.instance.authState.state.keys, (0, pino_1.default)({ level: 'error' })),
                }, logger: (0, pino_1.default)({ level: this.logBaileys }), printQRInTerminal: false, mobile }), browserOptions), { version, markOnlineOnConnect: this.localSettings.always_online, retryRequestDelayMs: 350, maxMsgRetryCount: 4, fireInitQueries: true, connectTimeoutMs: 20000, keepAliveIntervalMs: 30000, qrTimeout: 45000, defaultQueryTimeoutMs: undefined, emitOwnEvents: false, shouldIgnoreJid: (jid) => {
                    const isGroupJid = this.localSettings.groups_ignore && (0, baileys_1.isJidGroup)(jid);
                    const isBroadcast = !this.localSettings.read_status && (0, baileys_1.isJidBroadcast)(jid);
                    const isNewsletter = (0, baileys_1.isJidNewsletter)(jid);
                    return isGroupJid || isBroadcast || isNewsletter;
                }, msgRetryCounterCache: this.msgRetryCounterCache, getMessage: (key) => __awaiter(this, void 0, void 0, function* () { return (yield this.getMessage(key)); }), generateHighQualityLinkPreview: true, syncFullHistory: this.localSettings.sync_full_history, shouldSyncHistoryMessage: (msg) => {
                    return this.historySyncNotification(msg);
                }, userDevicesCache: this.userDevicesCache, transactionOpts: { maxCommitRetries: 5, delayBetweenTriesMs: 2500 }, patchMessageBeforeSending(message) {
                    var _a, _b, _c, _d;
                    if (((_c = (_b = (_a = message.deviceSentMessage) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.listMessage) === null || _c === void 0 ? void 0 : _c.listType) === baileys_1.proto.Message.ListMessage.ListType.PRODUCT_LIST) {
                        message = JSON.parse(JSON.stringify(message));
                        message.deviceSentMessage.message.listMessage.listType = baileys_1.proto.Message.ListMessage.ListType.SINGLE_SELECT;
                    }
                    if (((_d = message.listMessage) === null || _d === void 0 ? void 0 : _d.listType) == baileys_1.proto.Message.ListMessage.ListType.PRODUCT_LIST) {
                        message = JSON.parse(JSON.stringify(message));
                        message.listMessage.listType = baileys_1.proto.Message.ListMessage.ListType.SINGLE_SELECT;
                    }
                    return message;
                } });
            this.endSession = false;
            this.logger.verbose('Creating socket');
            this.client = (0, baileys_1.default)(socketConfig);
            this.logger.verbose('Socket created');
            if (this.localSettings.wavoipToken && this.localSettings.wavoipToken.length > 0) {
                (0, useVoiceCallsBaileys_1.useVoiceCallsBaileys)(this.localSettings.wavoipToken, this.client, this.connectionStatus.state, true);
            }
            this.eventHandler();
            this.logger.verbose('Socket event handler initialized');
            this.client.ws.on('CB:call', (packet) => {
                console.log('CB:call', packet);
                const payload = {
                    event: 'CB:call',
                    packet: packet,
                };
                this.sendDataWebhook(wa_types_1.Events.CALL, payload, true, ['websocket']);
            });
            this.client.ws.on('CB:ack,class:call', (packet) => {
                console.log('CB:ack,class:call', packet);
                const payload = {
                    event: 'CB:ack,class:call',
                    packet: packet,
                };
                this.sendDataWebhook(wa_types_1.Events.CALL, payload, true, ['websocket']);
            });
            this.phoneNumber = number;
            return this.client;
        });
    }
    connectToWhatsapp(number, mobile) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Connecting to whatsapp');
            try {
                this.loadWebhook();
                this.loadChatwoot();
                this.loadSettings();
                this.loadWebsocket();
                this.loadRabbitmq();
                this.loadSqs();
                this.loadTypebot();
                this.loadProxy();
                this.loadChamaai();
                return yield this.createClient(number, mobile);
            }
            catch (error) {
                this.logger.error(error);
                throw new exceptions_1.InternalServerErrorException(error === null || error === void 0 ? void 0 : error.toString());
            }
        });
    }
    sendMobileCode() {
        return __awaiter(this, void 0, void 0, function* () {
        });
    }
    receiveMobileCode(code) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(code);
        });
    }
    reloadConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.createClient(this.phoneNumber, this.mobile);
            }
            catch (error) {
                this.logger.error(error);
                throw new exceptions_1.InternalServerErrorException(error === null || error === void 0 ? void 0 : error.toString());
            }
        });
    }
    eventHandler() {
        this.logger.verbose('Initializing event handler');
        this.client.ev.process((events) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (!this.endSession) {
                this.logger.verbose(`Event received: ${Object.keys(events).join(', ')}`);
                const database = this.configService.get('DATABASE');
                const settings = yield this.findSettings();
                if (events.call) {
                    this.logger.verbose('Listening event: call');
                    const call = events.call[0];
                    if ((settings === null || settings === void 0 ? void 0 : settings.reject_call) && call.status == 'offer') {
                        this.logger.verbose('Rejecting call');
                        this.client.rejectCall(call.id, call.from);
                    }
                    if (((_a = settings === null || settings === void 0 ? void 0 : settings.msg_call) === null || _a === void 0 ? void 0 : _a.trim().length) > 0 && call.status == 'offer') {
                        this.logger.verbose('Sending message in call');
                        const msg = yield this.client.sendMessage(call.from, {
                            text: settings.msg_call,
                        });
                        this.logger.verbose('Sending data to event messages.upsert');
                        this.client.ev.emit('messages.upsert', {
                            messages: [msg],
                            type: 'notify',
                        });
                    }
                    this.logger.verbose('Sending data to webhook in event CALL');
                    this.sendDataWebhook(wa_types_1.Events.CALL, call);
                }
                if (events['connection.update']) {
                    this.logger.verbose('Listening event: connection.update');
                    this.connectionUpdate(events['connection.update']);
                }
                if (events['creds.update']) {
                    this.logger.verbose('Listening event: creds.update');
                    this.instance.authState.saveCreds();
                }
                if (events['messaging-history.set']) {
                    this.logger.verbose('Listening event: messaging-history.set');
                    const payload = events['messaging-history.set'];
                    this.messageHandle['messaging-history.set'](payload, database);
                }
                if (events['messages.upsert']) {
                    this.logger.verbose('Listening event: messages.upsert');
                    const payload = events['messages.upsert'];
                    this.messageHandle['messages.upsert'](payload, database, settings);
                }
                if (events['messages.update']) {
                    this.logger.verbose('Listening event: messages.update');
                    const payload = events['messages.update'];
                    this.messageHandle['messages.update'](payload, database, settings);
                }
                if (events['presence.update']) {
                    this.logger.verbose('Listening event: presence.update');
                    const payload = events['presence.update'];
                    if (settings.groups_ignore && payload.id.includes('@g.us')) {
                        this.logger.verbose('group ignored');
                        return;
                    }
                    this.sendDataWebhook(wa_types_1.Events.PRESENCE_UPDATE, payload);
                }
                if (!(settings === null || settings === void 0 ? void 0 : settings.groups_ignore)) {
                    if (events['groups.upsert']) {
                        this.logger.verbose('Listening event: groups.upsert');
                        const payload = events['groups.upsert'];
                        this.groupHandler['groups.upsert'](payload);
                    }
                    if (events['groups.update']) {
                        this.logger.verbose('Listening event: groups.update');
                        const payload = events['groups.update'];
                        this.groupHandler['groups.update'](payload);
                    }
                    if (events['group-participants.update']) {
                        this.logger.verbose('Listening event: group-participants.update');
                        const payload = events['group-participants.update'];
                        this.groupHandler['group-participants.update'](payload);
                    }
                }
                if (events['chats.upsert']) {
                    this.logger.verbose('Listening event: chats.upsert');
                    const payload = events['chats.upsert'];
                    this.chatHandle['chats.upsert'](payload, database);
                }
                if (events['chats.update']) {
                    this.logger.verbose('Listening event: chats.update');
                    const payload = events['chats.update'];
                    this.chatHandle['chats.update'](payload);
                }
                if (events['chats.delete']) {
                    this.logger.verbose('Listening event: chats.delete');
                    const payload = events['chats.delete'];
                    this.chatHandle['chats.delete'](payload);
                }
                if (events['contacts.upsert']) {
                    this.logger.verbose('Listening event: contacts.upsert');
                    const payload = events['contacts.upsert'];
                    this.contactHandle['contacts.upsert'](payload, database);
                }
                if (events['contacts.update']) {
                    this.logger.verbose('Listening event: contacts.update');
                    const payload = events['contacts.update'];
                    this.contactHandle['contacts.update'](payload, database);
                }
                if (events[wa_types_1.Events.LABELS_ASSOCIATION]) {
                    this.logger.verbose('Listening event: labels.association');
                    const payload = events[wa_types_1.Events.LABELS_ASSOCIATION];
                    this.labelHandle[wa_types_1.Events.LABELS_ASSOCIATION](payload, database);
                    return;
                }
                if (events[wa_types_1.Events.LABELS_EDIT]) {
                    this.logger.verbose('Listening event: labels.edit');
                    const payload = events[wa_types_1.Events.LABELS_EDIT];
                    this.labelHandle[wa_types_1.Events.LABELS_EDIT](payload, database);
                    return;
                }
            }
        }));
    }
    historySyncNotification(msg) {
        const instance = { instanceName: this.instance.name };
        if (this.localChatwoot.enabled &&
            this.localChatwoot.import_messages &&
            this.isSyncNotificationFromUsedSyncType(msg)) {
            if (msg.chunkOrder === 1) {
                this.chatwootService.startImportHistoryMessages(instance);
            }
            if (msg.progress === 100) {
                setTimeout(() => {
                    this.chatwootService.importHistoryMessages(instance);
                }, 10000);
            }
        }
        return true;
    }
    isSyncNotificationFromUsedSyncType(msg) {
        return ((this.localSettings.sync_full_history && (msg === null || msg === void 0 ? void 0 : msg.syncType) === 2) ||
            (!this.localSettings.sync_full_history && (msg === null || msg === void 0 ? void 0 : msg.syncType) === 3));
    }
    profilePicture(number) {
        return __awaiter(this, void 0, void 0, function* () {
            const jid = this.createJid(number);
            this.logger.verbose('Getting profile picture with jid: ' + jid);
            try {
                this.logger.verbose('Getting profile picture url');
                return {
                    wuid: jid,
                    profilePictureUrl: yield this.client.profilePictureUrl(jid, 'image'),
                };
            }
            catch (error) {
                this.logger.verbose('Profile picture not found');
                return {
                    wuid: jid,
                    profilePictureUrl: null,
                };
            }
        });
    }
    getStatus(number) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const jid = this.createJid(number);
            this.logger.verbose('Getting profile status with jid:' + jid);
            try {
                this.logger.verbose('Getting status');
                return {
                    wuid: jid,
                    status: (_a = (yield this.client.fetchStatus(jid))[0]) === null || _a === void 0 ? void 0 : _a.status,
                };
            }
            catch (error) {
                this.logger.verbose('Status not found');
                return {
                    wuid: jid,
                    status: null,
                };
            }
        });
    }
    fetchProfile(instanceName, number) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        return __awaiter(this, void 0, void 0, function* () {
            const jid = number ? this.createJid(number) : (_b = (_a = this.client) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.id;
            const onWhatsapp = (_c = (yield this.whatsappNumber({ numbers: [jid] }))) === null || _c === void 0 ? void 0 : _c.shift();
            if (!onWhatsapp.exists) {
                throw new exceptions_1.BadRequestException(onWhatsapp);
            }
            this.logger.verbose('Getting profile with jid: ' + jid);
            try {
                this.logger.verbose('Getting profile info');
                if (number) {
                    const info = (_d = (yield this.whatsappNumber({ numbers: [jid] }))) === null || _d === void 0 ? void 0 : _d.shift();
                    const picture = yield this.profilePicture(info === null || info === void 0 ? void 0 : info.jid);
                    const status = yield this.getStatus(info === null || info === void 0 ? void 0 : info.jid);
                    const business = yield this.fetchBusinessProfile(info === null || info === void 0 ? void 0 : info.jid);
                    return {
                        wuid: (info === null || info === void 0 ? void 0 : info.jid) || jid,
                        name: info === null || info === void 0 ? void 0 : info.name,
                        numberExists: info === null || info === void 0 ? void 0 : info.exists,
                        picture: picture === null || picture === void 0 ? void 0 : picture.profilePictureUrl,
                        status: status === null || status === void 0 ? void 0 : status.status,
                        isBusiness: business.isBusiness,
                        email: business === null || business === void 0 ? void 0 : business.email,
                        description: business === null || business === void 0 ? void 0 : business.description,
                        website: (_e = business === null || business === void 0 ? void 0 : business.website) === null || _e === void 0 ? void 0 : _e.shift(),
                    };
                }
                else {
                    const info = yield server_module_1.waMonitor.instanceInfo(instanceName);
                    const business = yield this.fetchBusinessProfile(jid);
                    return {
                        wuid: jid,
                        name: (_f = info === null || info === void 0 ? void 0 : info.instance) === null || _f === void 0 ? void 0 : _f.profileName,
                        numberExists: true,
                        picture: (_g = info === null || info === void 0 ? void 0 : info.instance) === null || _g === void 0 ? void 0 : _g.profilePictureUrl,
                        status: (_h = info === null || info === void 0 ? void 0 : info.instance) === null || _h === void 0 ? void 0 : _h.profileStatus,
                        isBusiness: business.isBusiness,
                        email: business === null || business === void 0 ? void 0 : business.email,
                        description: business === null || business === void 0 ? void 0 : business.description,
                        website: (_j = business === null || business === void 0 ? void 0 : business.website) === null || _j === void 0 ? void 0 : _j.shift(),
                    };
                }
            }
            catch (error) {
                this.logger.verbose('Profile not found');
                return {
                    wuid: jid,
                    name: null,
                    picture: null,
                    status: null,
                    os: null,
                    isBusiness: false,
                };
            }
        });
    }
    sendMessageWithTyping(number, message, options, isChatwoot = false) {
        var _a, _b, _c, _d, _e, _f, _g;
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Sending message with typing');
            this.logger.verbose(`Check if number "${number}" is WhatsApp`);
            const isWA = (_a = (yield this.whatsappNumber({ numbers: [number] }))) === null || _a === void 0 ? void 0 : _a.shift();
            this.logger.verbose(`Exists: "${isWA.exists}" | jid: ${isWA.jid}`);
            if (!isWA.exists && !(0, baileys_1.isJidGroup)(isWA.jid) && !isWA.jid.includes('@broadcast') && !isWA.jid.includes('@lid')) {
                if (this.localChatwoot.enabled) {
                    const body = {
                        key: { remoteJid: isWA.jid },
                    };
                    this.chatwootService.eventWhatsapp('contact.is_not_in_wpp', { instanceName: this.instance.name }, body);
                }
                throw new exceptions_1.BadRequestException(isWA);
            }
            const sender = isWA.jid;
            try {
                if (options === null || options === void 0 ? void 0 : options.delay) {
                    this.logger.verbose('Delaying message');
                    if (options.delay > 20000) {
                        let remainingDelay = options.delay;
                        while (remainingDelay > 20000) {
                            yield this.client.presenceSubscribe(sender);
                            yield this.client.sendPresenceUpdate((_b = options.presence) !== null && _b !== void 0 ? _b : 'composing', sender);
                            yield (0, baileys_1.delay)(20000);
                            yield this.client.sendPresenceUpdate('paused', sender);
                            remainingDelay -= 20000;
                        }
                        if (remainingDelay > 0) {
                            yield this.client.presenceSubscribe(sender);
                            yield this.client.sendPresenceUpdate((_c = options.presence) !== null && _c !== void 0 ? _c : 'composing', sender);
                            yield (0, baileys_1.delay)(remainingDelay);
                            yield this.client.sendPresenceUpdate('paused', sender);
                        }
                    }
                    else {
                        yield this.client.presenceSubscribe(sender);
                        yield this.client.sendPresenceUpdate((_d = options.presence) !== null && _d !== void 0 ? _d : 'composing', sender);
                        yield (0, baileys_1.delay)(options.delay);
                        yield this.client.sendPresenceUpdate('paused', sender);
                    }
                }
                const linkPreview = (options === null || options === void 0 ? void 0 : options.linkPreview) != false ? undefined : false;
                let quoted;
                if (options === null || options === void 0 ? void 0 : options.quoted) {
                    const m = options === null || options === void 0 ? void 0 : options.quoted;
                    const msg = (m === null || m === void 0 ? void 0 : m.message) ? m : (yield this.getMessage(m.key, true));
                    if (msg) {
                        quoted = msg;
                        this.logger.verbose('Quoted message');
                    }
                }
                let mentions;
                if ((0, baileys_1.isJidGroup)(sender)) {
                    try {
                        let group;
                        const cache = this.configService.get('CACHE');
                        if (!cache.REDIS.ENABLED && !cache.LOCAL.ENABLED)
                            group = yield this.findGroup({ groupJid: sender }, 'inner');
                        else
                            group = yield this.getGroupMetadataCache(sender);
                        if (!group) {
                            throw new exceptions_1.NotFoundException('Group not found');
                        }
                        if (options === null || options === void 0 ? void 0 : options.mentions) {
                            this.logger.verbose('Mentions defined');
                            if ((_e = options.mentions) === null || _e === void 0 ? void 0 : _e.everyOne) {
                                this.logger.verbose('Mentions everyone');
                                this.logger.verbose('Getting group metadata');
                                mentions = group.participants.map((participant) => participant.id);
                                this.logger.verbose('Getting group metadata for mentions');
                            }
                            else if ((_g = (_f = options.mentions) === null || _f === void 0 ? void 0 : _f.mentioned) === null || _g === void 0 ? void 0 : _g.length) {
                                this.logger.verbose('Mentions manually defined');
                                mentions = options.mentions.mentioned.map((mention) => {
                                    const jid = this.createJid(mention);
                                    if ((0, baileys_1.isJidGroup)(jid)) {
                                        return null;
                                    }
                                    return jid;
                                });
                            }
                        }
                    }
                    catch (error) {
                        throw new exceptions_1.NotFoundException('Group not found');
                    }
                }
                const messageSent = yield (() => __awaiter(this, void 0, void 0, function* () {
                    const option = {
                        quoted,
                    };
                    if (!message['audio'] &&
                        !message['poll'] &&
                        !message['sticker'] &&
                        !message['conversation'] &&
                        sender !== 'status@broadcast') {
                        if (message['reactionMessage']) {
                            this.logger.verbose('Sending reaction');
                            return yield this.client.sendMessage(sender, {
                                react: {
                                    text: message['reactionMessage']['text'],
                                    key: message['reactionMessage']['key'],
                                },
                            }, Object.assign(Object.assign({}, option), { useCachedGroupMetadata: !!this.configService.get('CACHE').REDIS.ENABLED &&
                                    !!this.configService.get('CACHE').LOCAL.ENABLED }));
                        }
                    }
                    if (message['conversation']) {
                        this.logger.verbose('Sending message');
                        return yield this.client.sendMessage(sender, {
                            text: message['conversation'],
                            mentions,
                            linkPreview: linkPreview,
                        }, Object.assign(Object.assign({}, option), { useCachedGroupMetadata: !!this.configService.get('CACHE').REDIS.ENABLED &&
                                !!this.configService.get('CACHE').LOCAL.ENABLED }));
                    }
                    if (!message['audio'] && !message['poll'] && sender != 'status@broadcast') {
                        this.logger.verbose('Sending message');
                        return yield this.client.sendMessage(sender, {
                            forward: {
                                key: { remoteJid: this.instance.wuid, fromMe: true },
                                message,
                            },
                            mentions,
                        }, Object.assign(Object.assign({}, option), { useCachedGroupMetadata: !!this.configService.get('CACHE').REDIS.ENABLED &&
                                !!this.configService.get('CACHE').LOCAL.ENABLED }));
                    }
                    if (sender === 'status@broadcast') {
                        this.logger.verbose('Sending message');
                        return yield this.client.sendMessage(sender, message['status'].content, {
                            backgroundColor: message['status'].option.backgroundColor,
                            font: message['status'].option.font,
                            statusJidList: message['status'].option.statusJidList,
                        });
                    }
                    this.logger.verbose('Sending message');
                    return yield this.client.sendMessage(sender, message, Object.assign(Object.assign({}, option), { useCachedGroupMetadata: !!this.configService.get('CACHE').REDIS.ENABLED &&
                            !!this.configService.get('CACHE').LOCAL.ENABLED }));
                }))();
                const contentMsg = messageSent.message[(0, baileys_1.getContentType)(messageSent.message)];
                const messageRaw = {
                    key: messageSent.key,
                    pushName: messageSent.pushName,
                    message: Object.assign({}, messageSent.message),
                    contextInfo: contentMsg === null || contentMsg === void 0 ? void 0 : contentMsg.contextInfo,
                    messageType: (0, baileys_1.getContentType)(messageSent.message),
                    messageTimestamp: messageSent.messageTimestamp,
                    owner: this.instance.name,
                    source: (0, baileys_1.getDevice)(messageSent.key.id),
                };
                const isMedia = messageRaw.messageType === 'imageMessage' ||
                    messageRaw.messageType === 'videoMessage' ||
                    messageRaw.messageType === 'documentMessage' ||
                    messageRaw.messageType === 'audioMessage';
                console.log('isMedia', isMedia);
                if ((this.localWebhook.webhook_base64 === true ||
                    (this.configService.get('WEBSOCKET').GLOBAL_EVENTS === true &&
                        this.configService.get('WEBSOCKET').ENABLED === true)) &&
                    isMedia) {
                    const buffer = yield (0, baileys_1.downloadMediaMessage)({ key: messageRaw.key, message: messageRaw === null || messageRaw === void 0 ? void 0 : messageRaw.message }, 'buffer', {}, {
                        logger: (0, pino_1.default)({ level: 'error' }),
                        reuploadRequest: this.client.updateMediaMessage,
                    });
                    messageRaw.message.base64 = buffer ? buffer.toString('base64') : undefined;
                }
                this.logger.log(messageRaw);
                this.logger.verbose('Sending data to webhook in event SEND_MESSAGE');
                this.sendDataWebhook(wa_types_1.Events.SEND_MESSAGE, messageRaw);
                if (this.localChatwoot.enabled && !isChatwoot) {
                    this.chatwootService.eventWhatsapp(wa_types_1.Events.SEND_MESSAGE, { instanceName: this.instance.name }, messageRaw);
                }
                this.logger.verbose('Inserting message in database');
                yield this.repository.message.insert([messageRaw], this.instance.name, this.configService.get('DATABASE').SAVE_DATA.NEW_MESSAGE);
                return messageSent;
            }
            catch (error) {
                this.logger.error(error);
                throw new exceptions_1.BadRequestException(error.toString());
            }
        });
    }
    sendPresence(data) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { number } = data;
                this.logger.verbose(`Check if number "${number}" is WhatsApp`);
                const isWA = (_a = (yield this.whatsappNumber({ numbers: [number] }))) === null || _a === void 0 ? void 0 : _a.shift();
                this.logger.verbose(`Exists: "${isWA.exists}" | jid: ${isWA.jid}`);
                if (!isWA.exists && !(0, baileys_1.isJidGroup)(isWA.jid) && !isWA.jid.includes('@broadcast') && !isWA.jid.includes('@lid')) {
                    throw new exceptions_1.BadRequestException(isWA);
                }
                const sender = isWA.jid;
                if (((_b = data === null || data === void 0 ? void 0 : data.options) === null || _b === void 0 ? void 0 : _b.delay) && ((_c = data === null || data === void 0 ? void 0 : data.options) === null || _c === void 0 ? void 0 : _c.delay) > 20000) {
                    let remainingDelay = data === null || data === void 0 ? void 0 : data.options.delay;
                    while (remainingDelay > 20000) {
                        yield this.client.presenceSubscribe(sender);
                        yield this.client.sendPresenceUpdate((_e = (_d = data === null || data === void 0 ? void 0 : data.options) === null || _d === void 0 ? void 0 : _d.presence) !== null && _e !== void 0 ? _e : 'composing', sender);
                        yield (0, baileys_1.delay)(20000);
                        yield this.client.sendPresenceUpdate('paused', sender);
                        remainingDelay -= 20000;
                    }
                    if (remainingDelay > 0) {
                        yield this.client.presenceSubscribe(sender);
                        yield this.client.sendPresenceUpdate((_g = (_f = data === null || data === void 0 ? void 0 : data.options) === null || _f === void 0 ? void 0 : _f.presence) !== null && _g !== void 0 ? _g : 'composing', sender);
                        yield (0, baileys_1.delay)(remainingDelay);
                        yield this.client.sendPresenceUpdate('paused', sender);
                    }
                }
                else {
                    yield this.client.presenceSubscribe(sender);
                    yield this.client.sendPresenceUpdate((_j = (_h = data === null || data === void 0 ? void 0 : data.options) === null || _h === void 0 ? void 0 : _h.presence) !== null && _j !== void 0 ? _j : 'composing', sender);
                    yield (0, baileys_1.delay)((_k = data === null || data === void 0 ? void 0 : data.options) === null || _k === void 0 ? void 0 : _k.delay);
                    yield this.client.sendPresenceUpdate('paused', sender);
                }
            }
            catch (error) {
                this.logger.error(error);
                throw new exceptions_1.BadRequestException(error.toString());
            }
        });
    }
    setPresence(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.client.sendPresenceUpdate(data.presence);
                this.logger.verbose('Sending presence update: ' + data.presence);
            }
            catch (error) {
                this.logger.error(error);
                throw new exceptions_1.BadRequestException(error.toString());
            }
        });
    }
    textMessage(data, isChatwoot = false) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Sending text message');
            return yield this.sendMessageWithTyping(data.number, {
                conversation: data.textMessage.text,
            }, data === null || data === void 0 ? void 0 : data.options, isChatwoot);
        });
    }
    pollMessage(data) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Sending poll message');
            return yield this.sendMessageWithTyping(data.number, {
                poll: {
                    name: data.pollMessage.name,
                    selectableCount: data.pollMessage.selectableCount,
                    values: data.pollMessage.values,
                },
            }, data === null || data === void 0 ? void 0 : data.options);
        });
    }
    formatStatusMessage(status) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Formatting status message');
            if (!status.type) {
                throw new exceptions_1.BadRequestException('Type is required');
            }
            if (!status.content) {
                throw new exceptions_1.BadRequestException('Content is required');
            }
            if (status.allContacts) {
                this.logger.verbose('All contacts defined as true');
                this.logger.verbose('Getting contacts from database');
                const contacts = yield this.repository.contact.find({
                    where: { owner: this.instance.name },
                });
                if (!contacts.length) {
                    throw new exceptions_1.BadRequestException('Contacts not found');
                }
                this.logger.verbose('Getting contacts with push name');
                status.statusJidList = contacts.filter((contact) => contact.pushName).map((contact) => contact.id);
                this.logger.verbose(status.statusJidList);
            }
            if (!((_a = status.statusJidList) === null || _a === void 0 ? void 0 : _a.length) && !status.allContacts) {
                throw new exceptions_1.BadRequestException('StatusJidList is required');
            }
            if (status.type === 'text') {
                this.logger.verbose('Type defined as text');
                if (!status.backgroundColor) {
                    throw new exceptions_1.BadRequestException('Background color is required');
                }
                if (!status.font) {
                    throw new exceptions_1.BadRequestException('Font is required');
                }
                return {
                    content: {
                        text: status.content,
                    },
                    option: {
                        backgroundColor: status.backgroundColor,
                        font: status.font,
                        statusJidList: status.statusJidList,
                    },
                };
            }
            if (status.type === 'image') {
                this.logger.verbose('Type defined as image');
                return {
                    content: {
                        image: {
                            url: status.content,
                        },
                        caption: status.caption,
                    },
                    option: {
                        statusJidList: status.statusJidList,
                    },
                };
            }
            if (status.type === 'video') {
                this.logger.verbose('Type defined as video');
                return {
                    content: {
                        video: {
                            url: status.content,
                        },
                        caption: status.caption,
                    },
                    option: {
                        statusJidList: status.statusJidList,
                    },
                };
            }
            if (status.type === 'audio') {
                this.logger.verbose('Type defined as audio');
                this.logger.verbose('Processing audio');
                const convert = yield this.processAudio(status.content, 'status@broadcast');
                if (typeof convert === 'string') {
                    this.logger.verbose('Audio processed');
                    const audio = fs_1.default.readFileSync(convert).toString('base64');
                    const result = {
                        content: {
                            audio: Buffer.from(audio, 'base64'),
                            ptt: true,
                            mimetype: 'audio/mp4',
                        },
                        option: {
                            statusJidList: status.statusJidList,
                        },
                    };
                    fs_1.default.unlinkSync(convert);
                    return result;
                }
                else {
                    throw new exceptions_1.InternalServerErrorException(convert);
                }
            }
            throw new exceptions_1.BadRequestException('Type not found');
        });
    }
    statusMessage(data) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Sending status message');
            const status = yield this.formatStatusMessage(data.statusMessage);
            return yield this.sendMessageWithTyping('status@broadcast', {
                status,
            });
        });
    }
    prepareMediaMessage(mediaMessage) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.logger.verbose('Preparing media message');
                const prepareMedia = yield (0, baileys_1.prepareWAMessageMedia)({
                    [mediaMessage.mediatype]: (0, class_validator_1.isURL)(mediaMessage.media)
                        ? { url: mediaMessage.media }
                        : Buffer.from(mediaMessage.media, 'base64'),
                }, { upload: this.client.waUploadToServer });
                const mediaType = mediaMessage.mediatype + 'Message';
                this.logger.verbose('Media type: ' + mediaType);
                if (mediaMessage.mediatype === 'document' && !mediaMessage.fileName) {
                    this.logger.verbose('If media type is document and file name is not defined then');
                    const regex = new RegExp(/.*\/(.+?)\./);
                    const arrayMatch = regex.exec(mediaMessage.media);
                    mediaMessage.fileName = arrayMatch[1];
                    this.logger.verbose('File name: ' + mediaMessage.fileName);
                }
                if (mediaMessage.mediatype === 'image' && !mediaMessage.fileName) {
                    mediaMessage.fileName = 'image.png';
                }
                if (mediaMessage.mediatype === 'video' && !mediaMessage.fileName) {
                    mediaMessage.fileName = 'video.mp4';
                }
                let mimetype;
                if (mediaMessage.mimetype) {
                    mimetype = mediaMessage.mimetype;
                }
                else {
                    mimetype = (0, node_mime_types_1.getMIMEType)(mediaMessage.fileName);
                    if (!mimetype && (0, class_validator_1.isURL)(mediaMessage.media)) {
                        let config = {
                            responseType: 'arraybuffer',
                        };
                        if (this.localProxy.enabled) {
                            config = Object.assign(Object.assign({}, config), { httpsAgent: (0, makeProxyAgent_1.makeProxyAgent)(this.localProxy.proxy) });
                        }
                        const response = yield axios_1.default.get(mediaMessage.media, config);
                        mimetype = response.headers['content-type'];
                    }
                }
                this.logger.verbose('Mimetype: ' + mimetype);
                prepareMedia[mediaType].caption = mediaMessage === null || mediaMessage === void 0 ? void 0 : mediaMessage.caption;
                prepareMedia[mediaType].mimetype = mimetype;
                prepareMedia[mediaType].fileName = mediaMessage.fileName;
                if (mediaMessage.mediatype === 'video') {
                    this.logger.verbose('Is media type video then set gif playback as false');
                    prepareMedia[mediaType].jpegThumbnail = Uint8Array.from((0, fs_1.readFileSync)((0, path_1.join)(process.cwd(), 'public', 'images', 'video-cover.png')));
                    prepareMedia[mediaType].gifPlayback = false;
                }
                this.logger.verbose('Generating wa message from content');
                return (0, baileys_1.generateWAMessageFromContent)('', { [mediaType]: Object.assign({}, prepareMedia[mediaType]) }, { userJid: this.instance.wuid });
            }
            catch (error) {
                this.logger.error(error);
                throw new exceptions_1.InternalServerErrorException((error === null || error === void 0 ? void 0 : error.toString()) || error);
            }
        });
    }
    convertToWebP(image, number) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.logger.verbose('Converting image to WebP to sticker');
                let imagePath;
                const hash = `${number}-${new Date().getTime()}`;
                this.logger.verbose('Hash to image name: ' + hash);
                const outputPath = `${(0, path_1.join)(this.storePath, 'temp', `${hash}.webp`)}`;
                this.logger.verbose('Output path: ' + outputPath);
                if ((0, class_validator_1.isBase64)(image)) {
                    this.logger.verbose('Image is base64');
                    const base64Data = image.replace(/^data:image\/(jpeg|png|gif);base64,/, '');
                    const imageBuffer = Buffer.from(base64Data, 'base64');
                    imagePath = `${(0, path_1.join)(this.storePath, 'temp', `temp-${hash}.png`)}`;
                    this.logger.verbose('Image path: ' + imagePath);
                    yield (0, sharp_1.default)(imageBuffer).toFile(imagePath);
                    this.logger.verbose('Image created');
                }
                else {
                    this.logger.verbose('Image is url');
                    const timestamp = new Date().getTime();
                    const url = `${image}?timestamp=${timestamp}`;
                    this.logger.verbose('including timestamp in url: ' + url);
                    let config = {
                        responseType: 'arraybuffer',
                    };
                    if (this.localProxy.enabled) {
                        config = Object.assign(Object.assign({}, config), { httpsAgent: (0, makeProxyAgent_1.makeProxyAgent)(this.localProxy.proxy) });
                    }
                    const response = yield axios_1.default.get(url, config);
                    this.logger.verbose('Getting image from url');
                    const imageBuffer = Buffer.from(response.data, 'binary');
                    imagePath = `${(0, path_1.join)(this.storePath, 'temp', `temp-${hash}.png`)}`;
                    this.logger.verbose('Image path: ' + imagePath);
                    yield (0, sharp_1.default)(imageBuffer).toFile(imagePath);
                    this.logger.verbose('Image created');
                }
                yield (0, sharp_1.default)(imagePath).webp().toFile(outputPath);
                this.logger.verbose('Image converted to WebP');
                fs_1.default.unlinkSync(imagePath);
                this.logger.verbose('Temp image deleted');
                return outputPath;
            }
            catch (error) {
                console.error('Erro ao converter a imagem para WebP:', error);
            }
        });
    }
    mediaSticker(data) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Sending media sticker');
            const convert = yield this.convertToWebP(data.stickerMessage.image, data.number);
            const result = yield this.sendMessageWithTyping(data.number, {
                sticker: { url: convert },
            }, data === null || data === void 0 ? void 0 : data.options);
            fs_1.default.unlinkSync(convert);
            this.logger.verbose('Converted image deleted');
            return result;
        });
    }
    mediaMessage(data, isChatwoot = false) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Sending media message');
            const generate = yield this.prepareMediaMessage(data.mediaMessage);
            return yield this.sendMessageWithTyping(data.number, Object.assign({}, generate.message), data === null || data === void 0 ? void 0 : data.options, isChatwoot);
        });
    }
    processAudio(audio, number) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Processing audio');
            let tempAudioPath;
            let outputAudio;
            number = number.replace(/\D/g, '');
            const hash = `${number}-${new Date().getTime()}`;
            this.logger.verbose('Hash to audio name: ' + hash);
            if ((0, class_validator_1.isURL)(audio)) {
                this.logger.verbose('Audio is url');
                outputAudio = `${(0, path_1.join)(this.storePath, 'temp', `${hash}.mp4`)}`;
                tempAudioPath = `${(0, path_1.join)(this.storePath, 'temp', `temp-${hash}.mp3`)}`;
                this.logger.verbose('Output audio path: ' + outputAudio);
                this.logger.verbose('Temp audio path: ' + tempAudioPath);
                const timestamp = new Date().getTime();
                const url = `${audio}?timestamp=${timestamp}`;
                this.logger.verbose('Including timestamp in url: ' + url);
                const response = yield axios_1.default.get(url, { responseType: 'arraybuffer' });
                this.logger.verbose('Getting audio from url');
                fs_1.default.writeFileSync(tempAudioPath, response.data);
            }
            else {
                this.logger.verbose('Audio is base64');
                outputAudio = `${(0, path_1.join)(this.storePath, 'temp', `${hash}.mp4`)}`;
                tempAudioPath = `${(0, path_1.join)(this.storePath, 'temp', `temp-${hash}.mp3`)}`;
                this.logger.verbose('Output audio path: ' + outputAudio);
                this.logger.verbose('Temp audio path: ' + tempAudioPath);
                const audioBuffer = Buffer.from(audio, 'base64');
                fs_1.default.writeFileSync(tempAudioPath, audioBuffer);
                this.logger.verbose('Temp audio created');
            }
            this.logger.verbose('Converting audio to mp4');
            return new Promise((resolve, reject) => {
                (0, child_process_1.exec)(`${ffmpeg_1.default.path} -i ${tempAudioPath} -vn -ab 128k -ar 44100 -f ipod ${outputAudio} -y`, (error) => {
                    fs_1.default.unlinkSync(tempAudioPath);
                    this.logger.verbose('Temp audio deleted');
                    if (error)
                        reject(error);
                    this.logger.verbose('Audio converted to mp4');
                    resolve(outputAudio);
                });
            });
        });
    }
    audioWhatsapp(data, isChatwoot = false) {
        var _a, _b, _c, _d, _e;
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Sending audio whatsapp');
            if (!((_a = data.options) === null || _a === void 0 ? void 0 : _a.encoding) && ((_b = data.options) === null || _b === void 0 ? void 0 : _b.encoding) !== false) {
                data.options.encoding = true;
            }
            if ((_c = data.options) === null || _c === void 0 ? void 0 : _c.encoding) {
                const convert = yield this.processAudio(data.audioMessage.audio, data.number);
                if (typeof convert === 'string') {
                    const audio = fs_1.default.readFileSync(convert).toString('base64');
                    const result = this.sendMessageWithTyping(data.number, {
                        audio: Buffer.from(audio, 'base64'),
                        ptt: true,
                        mimetype: 'audio/mp4',
                    }, { presence: 'recording', delay: (_d = data === null || data === void 0 ? void 0 : data.options) === null || _d === void 0 ? void 0 : _d.delay }, isChatwoot);
                    fs_1.default.unlinkSync(convert);
                    this.logger.verbose('Converted audio deleted');
                    return result;
                }
                else {
                    throw new exceptions_1.InternalServerErrorException(convert);
                }
            }
            return yield this.sendMessageWithTyping(data.number, {
                audio: (0, class_validator_1.isURL)(data.audioMessage.audio)
                    ? { url: data.audioMessage.audio }
                    : Buffer.from(data.audioMessage.audio, 'base64'),
                ptt: true,
                mimetype: 'audio/ogg; codecs=opus',
            }, { presence: 'recording', delay: (_e = data === null || data === void 0 ? void 0 : data.options) === null || _e === void 0 ? void 0 : _e.delay }, isChatwoot);
        });
    }
    buttonMessage() {
        return __awaiter(this, void 0, void 0, function* () {
            throw new exceptions_1.BadRequestException('Method not available on WhatsApp Baileys');
        });
    }
    locationMessage(data) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Sending location message');
            return yield this.sendMessageWithTyping(data.number, {
                locationMessage: {
                    degreesLatitude: data.locationMessage.latitude,
                    degreesLongitude: data.locationMessage.longitude,
                    name: (_a = data.locationMessage) === null || _a === void 0 ? void 0 : _a.name,
                    address: (_b = data.locationMessage) === null || _b === void 0 ? void 0 : _b.address,
                },
            }, data === null || data === void 0 ? void 0 : data.options);
        });
    }
    listMessage(data) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Sending list message');
            return yield this.sendMessageWithTyping(data.number, {
                listMessage: {
                    title: data.listMessage.title,
                    description: data.listMessage.description,
                    buttonText: (_a = data.listMessage) === null || _a === void 0 ? void 0 : _a.buttonText,
                    footerText: (_b = data.listMessage) === null || _b === void 0 ? void 0 : _b.footerText,
                    sections: data.listMessage.sections,
                    listType: 2,
                },
            }, data === null || data === void 0 ? void 0 : data.options);
        });
    }
    contactMessage(data) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Sending contact message');
            const message = {};
            const vcard = (contact) => {
                this.logger.verbose('Creating vcard');
                let result = 'BEGIN:VCARD\n' + 'VERSION:3.0\n' + `N:${contact.fullName}\n` + `FN:${contact.fullName}\n`;
                if (contact.organization) {
                    this.logger.verbose('Organization defined');
                    result += `ORG:${contact.organization};\n`;
                }
                if (contact.email) {
                    this.logger.verbose('Email defined');
                    result += `EMAIL:${contact.email}\n`;
                }
                if (contact.url) {
                    this.logger.verbose('Url defined');
                    result += `URL:${contact.url}\n`;
                }
                if (!contact.wuid) {
                    this.logger.verbose('Wuid defined');
                    contact.wuid = this.createJid(contact.phoneNumber);
                }
                result += `item1.TEL;waid=${contact.wuid}:${contact.phoneNumber}\n` + 'item1.X-ABLabel:Celular\n' + 'END:VCARD';
                this.logger.verbose('Vcard created');
                return result;
            };
            if (data.contactMessage.length === 1) {
                message.contactMessage = {
                    displayName: data.contactMessage[0].fullName,
                    vcard: vcard(data.contactMessage[0]),
                };
            }
            else {
                message.contactsArrayMessage = {
                    displayName: `${data.contactMessage.length} contacts`,
                    contacts: data.contactMessage.map((contact) => {
                        return {
                            displayName: contact.fullName,
                            vcard: vcard(contact),
                        };
                    }),
                };
            }
            return yield this.sendMessageWithTyping(data.number, Object.assign({}, message), data === null || data === void 0 ? void 0 : data.options);
        });
    }
    reactionMessage(data) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Sending reaction message');
            return yield this.sendMessageWithTyping(data.reactionMessage.key.remoteJid, {
                reactionMessage: {
                    key: data.reactionMessage.key,
                    text: data.reactionMessage.reaction,
                },
            });
        });
    }
    whatsappNumber(data) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Getting whatsapp number');
            const jids = {
                groups: [],
                broadcast: [],
                users: [],
            };
            data.numbers.forEach((number) => {
                const jid = this.createJid(number);
                if ((0, baileys_1.isJidGroup)(jid)) {
                    jids.groups.push({ number, jid });
                }
                else if (jid === 'status@broadcast') {
                    jids.broadcast.push({ number, jid });
                }
                else {
                    jids.users.push({ number, jid });
                }
            });
            const onWhatsapp = [];
            onWhatsapp.push(...jids.broadcast.map(({ jid, number }) => new chat_dto_1.OnWhatsAppDto(jid, false, number)));
            const groups = yield Promise.all(jids.groups.map(({ jid, number }) => __awaiter(this, void 0, void 0, function* () {
                const group = yield this.findGroup({ groupJid: jid }, 'inner');
                if (!group) {
                    return new chat_dto_1.OnWhatsAppDto(jid, false, number);
                }
                return new chat_dto_1.OnWhatsAppDto(group.id, !!(group === null || group === void 0 ? void 0 : group.id), number, group === null || group === void 0 ? void 0 : group.subject);
            })));
            onWhatsapp.push(...groups);
            const contacts = yield this.repository.contact.findManyById({
                owner: this.instance.name,
                ids: jids.users.map(({ jid }) => (jid.startsWith('+') ? jid.substring(1) : jid)),
            });
            const numbersToVerify = jids.users.map(({ jid }) => jid.replace('+', ''));
            const verify = yield this.client.onWhatsApp(...numbersToVerify);
            const users = yield Promise.all(jids.users.map((user) => __awaiter(this, void 0, void 0, function* () {
                var _a;
                let numberVerified = null;
                if (user.number.startsWith('55')) {
                    const numberWithDigit = user.number.slice(4, 5) === '9' && user.number.length === 13
                        ? user.number
                        : `${user.number.slice(0, 4)}9${user.number.slice(4)}`;
                    const numberWithoutDigit = user.number.length === 12 ? user.number : user.number.slice(0, 4) + user.number.slice(5);
                    numberVerified = verify.find((v) => v.jid === `${numberWithDigit}@s.whatsapp.net` || v.jid === `${numberWithoutDigit}@s.whatsapp.net`);
                }
                if (!numberVerified && (user.number.startsWith('52') || user.number.startsWith('54'))) {
                    let prefix = '';
                    if (user.number.startsWith('52')) {
                        prefix = '1';
                    }
                    if (user.number.startsWith('54')) {
                        prefix = '9';
                    }
                    const numberWithDigit = user.number.slice(2, 3) === prefix && user.number.length === 13
                        ? user.number
                        : `${user.number.slice(0, 2)}${prefix}${user.number.slice(2)}`;
                    const numberWithoutDigit = user.number.length === 12 ? user.number : user.number.slice(0, 2) + user.number.slice(3);
                    numberVerified = verify.find((v) => v.jid === `${numberWithDigit}@s.whatsapp.net` || v.jid === `${numberWithoutDigit}@s.whatsapp.net`);
                }
                if (!numberVerified) {
                    numberVerified = verify.find((v) => v.jid === user.jid);
                }
                const numberJid = (numberVerified === null || numberVerified === void 0 ? void 0 : numberVerified.jid) || user.jid;
                return {
                    exists: !!(numberVerified === null || numberVerified === void 0 ? void 0 : numberVerified.exists),
                    jid: numberJid,
                    name: (_a = contacts.find((c) => c.id === numberJid)) === null || _a === void 0 ? void 0 : _a.pushName,
                    number: user.number,
                };
            })));
            onWhatsapp.push(...users);
            return onWhatsapp;
        });
    }
    markMessageAsRead(data) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Marking message as read');
            try {
                const keys = [];
                data.read_messages.forEach((read) => {
                    if ((0, baileys_1.isJidGroup)(read.remoteJid) || (0, baileys_1.isJidUser)(read.remoteJid)) {
                        keys.push({
                            remoteJid: read.remoteJid,
                            fromMe: read.fromMe,
                            id: read.id,
                        });
                    }
                });
                yield this.client.readMessages(keys);
                return { message: 'Read messages', read: 'success' };
            }
            catch (error) {
                throw new exceptions_1.InternalServerErrorException('Read messages fail', error.toString());
            }
        });
    }
    getLastMessage(number) {
        return __awaiter(this, void 0, void 0, function* () {
            const messages = yield this.fetchMessages({
                where: {
                    key: {
                        remoteJid: number,
                    },
                    owner: this.instance.name,
                },
            });
            let lastMessage = messages.pop();
            for (const message of messages) {
                if (message.messageTimestamp >= lastMessage.messageTimestamp) {
                    lastMessage = message;
                }
            }
            return lastMessage;
        });
    }
    archiveChat(data) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Archiving chat');
            try {
                let last_message = data.lastMessage;
                let number = data.chat;
                if (!last_message && number) {
                    last_message = yield this.getLastMessage(number);
                }
                else {
                    last_message = data.lastMessage;
                    last_message.messageTimestamp = (_a = last_message === null || last_message === void 0 ? void 0 : last_message.messageTimestamp) !== null && _a !== void 0 ? _a : Date.now();
                    number = (_b = last_message === null || last_message === void 0 ? void 0 : last_message.key) === null || _b === void 0 ? void 0 : _b.remoteJid;
                }
                if (!last_message || Object.keys(last_message).length === 0) {
                    throw new exceptions_1.NotFoundException('Last message not found');
                }
                yield this.client.chatModify({
                    archive: data.archive,
                    lastMessages: [last_message],
                }, this.createJid(number));
                return {
                    chatId: number,
                    archived: true,
                };
            }
            catch (error) {
                throw new exceptions_1.InternalServerErrorException({
                    archived: false,
                    message: ['An error occurred while archiving the chat. Open a calling.', error.toString()],
                });
            }
        });
    }
    markChatUnread(data) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Marking chat as unread');
            try {
                let last_message = data.lastMessage;
                let number = data.chat;
                if (!last_message && number) {
                    last_message = yield this.getLastMessage(number);
                }
                else {
                    last_message = data.lastMessage;
                    last_message.messageTimestamp = (_a = last_message === null || last_message === void 0 ? void 0 : last_message.messageTimestamp) !== null && _a !== void 0 ? _a : Date.now();
                    number = (_b = last_message === null || last_message === void 0 ? void 0 : last_message.key) === null || _b === void 0 ? void 0 : _b.remoteJid;
                }
                if (!last_message || Object.keys(last_message).length === 0) {
                    throw new exceptions_1.NotFoundException('Last message not found');
                }
                yield this.client.chatModify({
                    markRead: false,
                    lastMessages: [last_message],
                }, this.createJid(number));
                return {
                    chatId: number,
                    markedChatUnread: true,
                };
            }
            catch (error) {
                throw new exceptions_1.InternalServerErrorException({
                    markedChatUnread: false,
                    message: ['An error occurred while marked unread the chat. Open a calling.', error.toString()],
                });
            }
        });
    }
    deleteMessage(del) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Deleting message');
            try {
                return yield this.client.sendMessage(del.remoteJid, { delete: del });
            }
            catch (error) {
                throw new exceptions_1.InternalServerErrorException('Error while deleting message for everyone', error === null || error === void 0 ? void 0 : error.toString());
            }
        });
    }
    getBase64FromMediaMessage(data) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Getting base64 from media message');
            try {
                const m = data === null || data === void 0 ? void 0 : data.message;
                const convertToMp4 = (_a = data === null || data === void 0 ? void 0 : data.convertToMp4) !== null && _a !== void 0 ? _a : false;
                const msg = (m === null || m === void 0 ? void 0 : m.message) ? m : (yield this.getMessage(m.key, true));
                if (!msg) {
                    throw 'Message not found';
                }
                for (const subtype of wa_types_1.MessageSubtype) {
                    if (msg.message[subtype]) {
                        msg.message = msg.message[subtype].message;
                    }
                }
                let mediaMessage;
                let mediaType;
                for (const type of wa_types_1.TypeMediaMessage) {
                    mediaMessage = msg.message[type];
                    if (mediaMessage) {
                        mediaType = type;
                        break;
                    }
                }
                if (!mediaMessage) {
                    throw 'The message is not of the media type';
                }
                if (typeof mediaMessage['mediaKey'] === 'object') {
                    msg.message = JSON.parse(JSON.stringify(msg.message));
                }
                this.logger.verbose('Downloading media message');
                const buffer = yield (0, baileys_1.downloadMediaMessage)({ key: msg === null || msg === void 0 ? void 0 : msg.key, message: msg === null || msg === void 0 ? void 0 : msg.message }, 'buffer', {}, {
                    logger: (0, pino_1.default)({ level: 'error' }),
                    reuploadRequest: this.client.updateMediaMessage,
                });
                const typeMessage = (0, baileys_1.getContentType)(msg.message);
                if (convertToMp4 && typeMessage === 'audioMessage') {
                    this.logger.verbose('Converting audio to mp4');
                    const number = msg.key.remoteJid.split('@')[0];
                    const convert = yield this.processAudio(buffer.toString('base64'), number);
                    if (typeof convert === 'string') {
                        const audio = fs_1.default.readFileSync(convert).toString('base64');
                        this.logger.verbose('Audio converted to mp4');
                        const result = {
                            mediaType,
                            fileName: mediaMessage['fileName'],
                            caption: mediaMessage['caption'],
                            size: {
                                fileLength: mediaMessage['fileLength'],
                                height: mediaMessage['height'],
                                width: mediaMessage['width'],
                            },
                            mimetype: 'audio/mp4',
                            base64: Buffer.from(audio, 'base64').toString('base64'),
                        };
                        fs_1.default.unlinkSync(convert);
                        this.logger.verbose('Converted audio deleted');
                        this.logger.verbose('Media message downloaded');
                        return result;
                    }
                }
                this.logger.verbose('Media message downloaded');
                return {
                    mediaType,
                    fileName: mediaMessage['fileName'],
                    caption: mediaMessage['caption'],
                    size: {
                        fileLength: mediaMessage['fileLength'],
                        height: mediaMessage['height'],
                        width: mediaMessage['width'],
                    },
                    mimetype: mediaMessage['mimetype'],
                    base64: buffer.toString('base64'),
                };
            }
            catch (error) {
                this.logger.error(error);
                throw new exceptions_1.BadRequestException(error.toString());
            }
        });
    }
    fetchPrivacySettings() {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Fetching privacy settings');
            const privacy = yield this.client.fetchPrivacySettings();
            return {
                readreceipts: privacy.readreceipts,
                profile: privacy.profile,
                status: privacy.status,
                online: privacy.online,
                last: privacy.last,
                groupadd: privacy.groupadd,
            };
        });
    }
    updatePrivacySettings(settings) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Updating privacy settings');
            try {
                yield this.client.updateReadReceiptsPrivacy(settings.privacySettings.readreceipts);
                this.logger.verbose('Read receipts privacy updated');
                yield this.client.updateProfilePicturePrivacy(settings.privacySettings.profile);
                this.logger.verbose('Profile picture privacy updated');
                yield this.client.updateStatusPrivacy(settings.privacySettings.status);
                this.logger.verbose('Status privacy updated');
                yield this.client.updateOnlinePrivacy(settings.privacySettings.online);
                this.logger.verbose('Online privacy updated');
                yield this.client.updateLastSeenPrivacy(settings.privacySettings.last);
                this.logger.verbose('Last seen privacy updated');
                yield this.client.updateGroupsAddPrivacy(settings.privacySettings.groupadd);
                this.logger.verbose('Groups add privacy updated');
                this.reloadConnection();
                return {
                    update: 'success',
                    data: {
                        readreceipts: settings.privacySettings.readreceipts,
                        profile: settings.privacySettings.profile,
                        status: settings.privacySettings.status,
                        online: settings.privacySettings.online,
                        last: settings.privacySettings.last,
                        groupadd: settings.privacySettings.groupadd,
                    },
                };
            }
            catch (error) {
                throw new exceptions_1.InternalServerErrorException('Error updating privacy settings', error.toString());
            }
        });
    }
    fetchBusinessProfile(number) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Fetching business profile');
            try {
                const jid = number ? this.createJid(number) : this.instance.wuid;
                const profile = yield this.client.getBusinessProfile(jid);
                this.logger.verbose('Trying to get business profile');
                if (!profile) {
                    const info = yield this.whatsappNumber({ numbers: [jid] });
                    return Object.assign({ isBusiness: false, message: 'Not is business profile' }, info === null || info === void 0 ? void 0 : info.shift());
                }
                this.logger.verbose('Business profile fetched');
                return Object.assign({ isBusiness: true }, profile);
            }
            catch (error) {
                throw new exceptions_1.InternalServerErrorException('Error updating profile name', error.toString());
            }
        });
    }
    updateProfileName(name) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Updating profile name to ' + name);
            try {
                yield this.client.updateProfileName(name);
                return { update: 'success' };
            }
            catch (error) {
                throw new exceptions_1.InternalServerErrorException('Error updating profile name', error.toString());
            }
        });
    }
    updateProfileStatus(status) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Updating profile status to: ' + status);
            try {
                yield this.client.updateProfileStatus(status);
                return { update: 'success' };
            }
            catch (error) {
                throw new exceptions_1.InternalServerErrorException('Error updating profile status', error.toString());
            }
        });
    }
    updateProfilePicture(picture) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Updating profile picture');
            try {
                let pic;
                if ((0, class_validator_1.isURL)(picture)) {
                    this.logger.verbose('Picture is url');
                    const timestamp = new Date().getTime();
                    const url = `${picture}?timestamp=${timestamp}`;
                    this.logger.verbose('Including timestamp in url: ' + url);
                    let config = {
                        responseType: 'arraybuffer',
                    };
                    if (this.localProxy.enabled) {
                        config = Object.assign(Object.assign({}, config), { httpsAgent: (0, makeProxyAgent_1.makeProxyAgent)(this.localProxy.proxy) });
                    }
                    pic = (yield axios_1.default.get(url, config)).data;
                    this.logger.verbose('Getting picture from url');
                }
                else if ((0, class_validator_1.isBase64)(picture)) {
                    this.logger.verbose('Picture is base64');
                    pic = Buffer.from(picture, 'base64');
                    this.logger.verbose('Getting picture from base64');
                }
                else {
                    throw new exceptions_1.BadRequestException('"profilePicture" must be a url or a base64');
                }
                yield this.client.updateProfilePicture(this.instance.wuid, pic);
                this.logger.verbose('Profile picture updated');
                this.reloadConnection();
                return { update: 'success' };
            }
            catch (error) {
                throw new exceptions_1.InternalServerErrorException('Error updating profile picture', error.toString());
            }
        });
    }
    removeProfilePicture() {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Removing profile picture');
            try {
                yield this.client.removeProfilePicture(this.instance.wuid);
                this.reloadConnection();
                return { update: 'success' };
            }
            catch (error) {
                throw new exceptions_1.InternalServerErrorException('Error removing profile picture', error.toString());
            }
        });
    }
    blockUser(data) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Blocking user: ' + data.number);
            try {
                const { number } = data;
                this.logger.verbose(`Check if number "${number}" is WhatsApp`);
                const isWA = (_a = (yield this.whatsappNumber({ numbers: [number] }))) === null || _a === void 0 ? void 0 : _a.shift();
                this.logger.verbose(`Exists: "${isWA.exists}" | jid: ${isWA.jid}`);
                if (!isWA.exists && !(0, baileys_1.isJidGroup)(isWA.jid) && !isWA.jid.includes('@broadcast') && !isWA.jid.includes('@lid')) {
                    throw new exceptions_1.BadRequestException(isWA);
                }
                const sender = isWA.jid;
                yield this.client.updateBlockStatus(sender, data.status);
                return { block: 'success' };
            }
            catch (error) {
                throw new exceptions_1.InternalServerErrorException('Error blocking user', error.toString());
            }
        });
    }
    updateMessage(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const jid = this.createJid(data.number);
                this.logger.verbose('Updating message');
                return yield this.client.sendMessage(jid, {
                    text: data.text,
                    edit: data.key,
                });
            }
            catch (error) {
                this.logger.error(error);
                throw new exceptions_1.BadRequestException(error.toString());
            }
        });
    }
    fetchLabels() {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Fetching labels');
            const labels = yield this.repository.labels.find({
                where: {
                    owner: this.instance.name,
                },
            });
            return labels.map((label) => ({
                color: label.color,
                name: label.name,
                id: label.id,
                predefinedId: label.predefinedId,
            }));
        });
    }
    handleLabel(data) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Adding label');
            const whatsappContact = yield this.whatsappNumber({ numbers: [data.number] });
            if (whatsappContact.length === 0) {
                throw new exceptions_1.NotFoundException('Number not found');
            }
            const contact = whatsappContact[0];
            if (!contact.exists) {
                throw new exceptions_1.NotFoundException('Number is not on WhatsApp');
            }
            try {
                if (data.action === 'add') {
                    yield this.client.addChatLabel(contact.jid, data.labelId);
                    return { numberJid: contact.jid, labelId: data.labelId, add: true };
                }
                if (data.action === 'remove') {
                    yield this.client.removeChatLabel(contact.jid, data.labelId);
                    return { numberJid: contact.jid, labelId: data.labelId, remove: true };
                }
            }
            catch (error) {
                throw new exceptions_1.BadRequestException(`Unable to ${data.action} label to chat`, error.toString());
            }
        });
    }
    updateGroupMetadataCache(groupJid) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const meta = yield this.client.groupMetadata(groupJid);
                yield groupMetadataCache.set(groupJid, {
                    timestamp: Date.now(),
                    data: meta,
                });
                return meta;
            }
            catch (error) {
                this.logger.error(error);
                return null;
            }
        });
    }
    getGroupMetadataCache(groupJid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(0, baileys_1.isJidGroup)(groupJid))
                return null;
            if (yield groupMetadataCache.has(groupJid)) {
                console.log('Has cache for group: ' + groupJid);
                const meta = yield groupMetadataCache.get(groupJid);
                if (Date.now() - meta.timestamp > 3600000) {
                    yield this.updateGroupMetadataCache(groupJid);
                }
                return meta.data;
            }
            return yield this.updateGroupMetadataCache(groupJid);
        });
    }
    createGroup(create) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Creating group: ' + create.subject);
            try {
                const participants = (yield this.whatsappNumber({ numbers: create.participants }))
                    .filter((participant) => participant.exists)
                    .map((participant) => participant.jid);
                const { id } = yield this.client.groupCreate(create.subject, participants);
                this.logger.verbose('Group created: ' + id);
                if (create === null || create === void 0 ? void 0 : create.description) {
                    this.logger.verbose('Updating group description: ' + create.description);
                    yield this.client.groupUpdateDescription(id, create.description);
                }
                if (create === null || create === void 0 ? void 0 : create.promoteParticipants) {
                    this.logger.verbose('Prometing group participants: ' + participants);
                    yield this.updateGParticipant({
                        groupJid: id,
                        action: 'promote',
                        participants: participants,
                    });
                }
                this.logger.verbose('Getting group metadata');
                const group = yield this.client.groupMetadata(id);
                return group;
            }
            catch (error) {
                this.logger.error(error);
                throw new exceptions_1.InternalServerErrorException('Error creating group', error.toString());
            }
        });
    }
    updateGroupPicture(picture) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Updating group picture');
            try {
                let pic;
                if ((0, class_validator_1.isURL)(picture.image)) {
                    this.logger.verbose('Picture is url');
                    const timestamp = new Date().getTime();
                    const url = `${picture.image}?timestamp=${timestamp}`;
                    this.logger.verbose('Including timestamp in url: ' + url);
                    let config = {
                        responseType: 'arraybuffer',
                    };
                    if (this.localProxy.enabled) {
                        config = Object.assign(Object.assign({}, config), { httpsAgent: (0, makeProxyAgent_1.makeProxyAgent)(this.localProxy.proxy) });
                    }
                    pic = (yield axios_1.default.get(url, config)).data;
                    this.logger.verbose('Getting picture from url');
                }
                else if ((0, class_validator_1.isBase64)(picture.image)) {
                    this.logger.verbose('Picture is base64');
                    pic = Buffer.from(picture.image, 'base64');
                    this.logger.verbose('Getting picture from base64');
                }
                else {
                    throw new exceptions_1.BadRequestException('"profilePicture" must be a url or a base64');
                }
                yield this.client.updateProfilePicture(picture.groupJid, pic);
                this.logger.verbose('Group picture updated');
                return { update: 'success' };
            }
            catch (error) {
                throw new exceptions_1.InternalServerErrorException('Error update group picture', error.toString());
            }
        });
    }
    updateGroupSubject(data) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Updating group subject to: ' + data.subject);
            try {
                yield this.client.groupUpdateSubject(data.groupJid, data.subject);
                return { update: 'success' };
            }
            catch (error) {
                throw new exceptions_1.InternalServerErrorException('Error updating group subject', error.toString());
            }
        });
    }
    updateGroupDescription(data) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Updating group description to: ' + data.description);
            try {
                yield this.client.groupUpdateDescription(data.groupJid, data.description);
                return { update: 'success' };
            }
            catch (error) {
                throw new exceptions_1.InternalServerErrorException('Error updating group description', error.toString());
            }
        });
    }
    findGroup(id, reply = 'out') {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Fetching group');
            try {
                const group = yield this.client.groupMetadata(id.groupJid);
                const picture = yield this.profilePicture(group.id);
                return {
                    id: group.id,
                    subject: group.subject,
                    subjectOwner: group.subjectOwner,
                    subjectTime: group.subjectTime,
                    pictureUrl: picture.profilePictureUrl,
                    size: group.participants.length,
                    creation: group.creation,
                    owner: group.owner,
                    desc: group.desc,
                    descId: group.descId,
                    restrict: group.restrict,
                    announce: group.announce,
                    participants: group.participants,
                };
            }
            catch (error) {
                if (reply === 'inner') {
                    return;
                }
                throw new exceptions_1.NotFoundException('Error fetching group', error.toString());
            }
        });
    }
    fetchAllGroups(getParticipants) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.localSettings.groups_ignore === true) {
                return;
            }
            this.logger.verbose('Fetching all groups');
            try {
                const fetch = Object.values(yield this.client.groupFetchAllParticipating());
                let groups = [];
                for (const group of fetch) {
                    const picture = yield this.profilePicture(group.id);
                    const result = {
                        id: group.id,
                        subject: group.subject,
                        subjectOwner: group.subjectOwner,
                        subjectTime: group.subjectTime,
                        pictureUrl: picture.profilePictureUrl,
                        size: group.participants.length,
                        creation: group.creation,
                        owner: group.owner,
                        desc: group.desc,
                        descId: group.descId,
                        restrict: group.restrict,
                        announce: group.announce,
                    };
                    if (getParticipants.getParticipants == 'true') {
                        result['participants'] = group.participants;
                    }
                    groups = [...groups, result];
                }
                return groups;
            }
            catch (error) {
                throw new exceptions_1.NotFoundException('Error fetching group', error.toString());
            }
        });
    }
    inviteCode(id) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Fetching invite code for group: ' + id.groupJid);
            try {
                const code = yield this.client.groupInviteCode(id.groupJid);
                return { inviteUrl: `https://chat.whatsapp.com/${code}`, inviteCode: code };
            }
            catch (error) {
                throw new exceptions_1.NotFoundException('No invite code', error.toString());
            }
        });
    }
    inviteInfo(id) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Fetching invite info for code: ' + id.inviteCode);
            try {
                return yield this.client.groupGetInviteInfo(id.inviteCode);
            }
            catch (error) {
                throw new exceptions_1.NotFoundException('No invite info', id.inviteCode);
            }
        });
    }
    sendInvite(id) {
        var _a, e_5, _b, _c;
        var _d;
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Sending invite for group: ' + id.groupJid);
            try {
                const inviteCode = yield this.inviteCode({ groupJid: id.groupJid });
                this.logger.verbose('Getting invite code: ' + inviteCode.inviteCode);
                const inviteUrl = inviteCode.inviteUrl;
                this.logger.verbose('Invite url: ' + inviteUrl);
                const numbers = id.numbers.map((number) => this.createJid(number));
                const description = (_d = id.description) !== null && _d !== void 0 ? _d : '';
                const msg = `${description}\n\n${inviteUrl}`;
                const message = {
                    conversation: msg,
                };
                try {
                    for (var _e = true, numbers_1 = __asyncValues(numbers), numbers_1_1; numbers_1_1 = yield numbers_1.next(), _a = numbers_1_1.done, !_a;) {
                        _c = numbers_1_1.value;
                        _e = false;
                        try {
                            const number = _c;
                            yield this.sendMessageWithTyping(number, message);
                        }
                        finally {
                            _e = true;
                        }
                    }
                }
                catch (e_5_1) { e_5 = { error: e_5_1 }; }
                finally {
                    try {
                        if (!_e && !_a && (_b = numbers_1.return)) yield _b.call(numbers_1);
                    }
                    finally { if (e_5) throw e_5.error; }
                }
                this.logger.verbose('Invite sent for numbers: ' + numbers.join(', '));
                return { send: true, inviteUrl };
            }
            catch (error) {
                throw new exceptions_1.NotFoundException('No send invite');
            }
        });
    }
    acceptInviteCode(id) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Joining the group by invitation code: ' + id.inviteCode);
            try {
                const groupJid = yield this.client.groupAcceptInvite(id.inviteCode);
                return { accepted: true, groupJid: groupJid };
            }
            catch (error) {
                throw new exceptions_1.NotFoundException('Accept invite error', error.toString());
            }
        });
    }
    revokeInviteCode(id) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Revoking invite code for group: ' + id.groupJid);
            try {
                const inviteCode = yield this.client.groupRevokeInvite(id.groupJid);
                return { revoked: true, inviteCode };
            }
            catch (error) {
                throw new exceptions_1.NotFoundException('Revoke error', error.toString());
            }
        });
    }
    findParticipants(id) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Fetching participants for group: ' + id.groupJid);
            try {
                const participants = (yield this.client.groupMetadata(id.groupJid)).participants;
                const contacts = yield this.repository.contact.findManyById({
                    owner: this.instance.name,
                    ids: participants.map((p) => p.id),
                });
                const parsedParticipants = participants.map((participant) => {
                    var _a, _b;
                    const contact = contacts.find((c) => c.id === participant.id);
                    return Object.assign(Object.assign({}, participant), { name: (_a = participant.name) !== null && _a !== void 0 ? _a : contact === null || contact === void 0 ? void 0 : contact.pushName, imgUrl: (_b = participant.imgUrl) !== null && _b !== void 0 ? _b : contact === null || contact === void 0 ? void 0 : contact.profilePictureUrl });
                });
                return { participants: parsedParticipants };
            }
            catch (error) {
                throw new exceptions_1.NotFoundException('No participants', error.toString());
            }
        });
    }
    updateGParticipant(update) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Updating participants');
            try {
                const participants = update.participants.map((p) => this.createJid(p));
                const updateParticipants = yield this.client.groupParticipantsUpdate(update.groupJid, participants, update.action);
                return { updateParticipants: updateParticipants };
            }
            catch (error) {
                throw new exceptions_1.BadRequestException('Error updating participants', error.toString());
            }
        });
    }
    updateGSetting(update) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Updating setting for group: ' + update.groupJid);
            try {
                const updateSetting = yield this.client.groupSettingUpdate(update.groupJid, update.action);
                return { updateSetting: updateSetting };
            }
            catch (error) {
                throw new exceptions_1.BadRequestException('Error updating setting', error.toString());
            }
        });
    }
    toggleEphemeral(update) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Toggling ephemeral for group: ' + update.groupJid);
            try {
                yield this.client.groupToggleEphemeral(update.groupJid, update.expiration);
                return { success: true };
            }
            catch (error) {
                throw new exceptions_1.BadRequestException('Error updating setting', error.toString());
            }
        });
    }
    leaveGroup(id) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.verbose('Leaving group: ' + id.groupJid);
            try {
                yield this.client.groupLeave(id.groupJid);
                return { groupJid: id.groupJid, leave: true };
            }
            catch (error) {
                throw new exceptions_1.BadRequestException('Unable to leave the group', error.toString());
            }
        });
    }
    templateMessage() {
        return __awaiter(this, void 0, void 0, function* () {
            throw new Error('Method not available in the Baileys service');
        });
    }
}
exports.BaileysStartupService = BaileysStartupService;
