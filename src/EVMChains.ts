
export const EVMChains = {
    POLYGON_TESTNET : {
        chainId: 80001,
        addresses: {
            swapContract: "0x140b71Bbc5605C97065CD22A3dFD0fe81260Be2F",
            btcRelayContract: "0xEB8546E8B955b7564239Be8452AC2a8B24c07Ed7"
        }
    },
    POLYGON : {
        chainId: 137,
        addresses: {
            swapContract: "0xF96cCB6e33c3f476D983Eed48817B128193B3bdd",
            btcRelayContract: "0x585005F61A4a56a453fa4e88216c0D37e782fFe3"
        }
    },
    Q: {
        chainId: 35441,
        addresses: {
            swapContract: "0x35D0baFC22DCF72aE530df0280d51d7531a4d44F",
            btcRelayContract: "0x5b9D4C04D7CeC6f52562a0eCcf5Aa61FB49CA7dE"
        },
        registryUrl: "https://api.github.com/repos/adambor/QLightning-registry/contents/registry.json?ref=main"
    }
};
