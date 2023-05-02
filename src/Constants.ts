import * as bitcoin from "bitcoinjs-lib";
import * as BN from "bn.js";

export const ConstantSoltoBTCLN = {
    baseFee: new BN("10"), //Network fee for lightning payment
    fee: new BN("2000"), //Network fee for lightning payment
    min: new BN("1000"),
    max: new BN("1000000"),
    refundGracePeriod: 10*60,
    authorizationGracePeriod: 5*60
};

export const ConstantBTCLNtoSol = {
    min: new BN("1000"),
    max: new BN("1000000"),
    claimGracePeriod: 10*60,
    authorizationGracePeriod: 5*60
};

export const ConstantSoltoBTC = {
    min: new BN("10000"),
    max: new BN("1000000"),
    refundGracePeriod: 10*60,
    authorizationGracePeriod: 5*60,
    network: bitcoin.networks.testnet
};

export const ConstantBTCtoSol = {
    min: new BN("10000"),
    max: new BN("1000000"),
    safetyFactor: 2,
    blocksTillTxConfirms: 12,
    maxConfirmations: 6,
    minSendWindow: 30*60,
    refundGracePeriod: 10*60,
    authorizationGracePeriod: 5*60,
    network: bitcoin.networks.testnet
};

export const Bitcoin = {
    satsMultiplier: new BN("100000000"),
    blockTime: 10*60
};
