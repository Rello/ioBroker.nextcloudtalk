declare global {
    namespace ioBroker {
        interface AdapterConfig {
            server: string;
            username: string;
            token: string;
            receiveEnabled: boolean;
            receiveRoom: string;
        }
    }
}

export {};
