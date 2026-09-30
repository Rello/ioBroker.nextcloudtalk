declare global {
    namespace ioBroker {
        interface AdapterConfig {
            server: string;
            username: string;
            token: string;
        }
    }
}

export {};
