/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/zuvi.json`.
 */
export type Zuvi = {
  "address": "6ptqmN5bGJnx5ahuJaUV3kNKz2JhNgguuzHx7yvEGdfL",
  "metadata": {
    "name": "zuvi",
    "version": "0.1.0",
    "spec": "0.1.0"
  },
  "instructions": [
    {
      "name": "acceptApplication",
      "discriminator": [
        32,
        123,
        133,
        159,
        182,
        237,
        161,
        163
      ],
      "accounts": [
        {
          "name": "listing"
        },
        {
          "name": "application",
          "writable": true
        },
        {
          "name": "owner",
          "signer": true
        },
        {
          "name": "clock",
          "address": "SysvarC1ock11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "applyRental",
      "discriminator": [
        253,
        118,
        96,
        111,
        200,
        52,
        80,
        49
      ],
      "accounts": [
        {
          "name": "listing"
        },
        {
          "name": "application",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  112,
                  112,
                  108,
                  105,
                  99,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "listing"
              },
              {
                "kind": "account",
                "path": "applicant"
              }
            ]
          }
        },
        {
          "name": "applicant",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "clock",
          "address": "SysvarC1ock11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "attestPda",
          "type": "pubkey"
        },
        {
          "name": "offerRent",
          "type": "u64"
        },
        {
          "name": "offerDeposit",
          "type": "u64"
        },
        {
          "name": "offerHash",
          "type": "string"
        }
      ]
    },
    {
      "name": "counterOffer",
      "discriminator": [
        212,
        52,
        120,
        221,
        104,
        231,
        68,
        97
      ],
      "accounts": [
        {
          "name": "listing"
        },
        {
          "name": "application",
          "writable": true
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "clock",
          "address": "SysvarC1ock11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "newRent",
          "type": "u64"
        },
        {
          "name": "newDeposit",
          "type": "u64"
        },
        {
          "name": "newHash",
          "type": "string"
        }
      ]
    },
    {
      "name": "createContract",
      "discriminator": [
        244,
        48,
        244,
        178,
        216,
        88,
        122,
        52
      ],
      "accounts": [
        {
          "name": "listing",
          "writable": true
        },
        {
          "name": "application"
        },
        {
          "name": "contract",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  116,
                  114,
                  97,
                  99,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "listing"
              },
              {
                "kind": "account",
                "path": "application.applicant",
                "account": "rentalApplication"
              }
            ]
          }
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "contract"
              }
            ]
          }
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "clock",
          "address": "SysvarC1ock11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "start",
          "type": "i64"
        },
        {
          "name": "end",
          "type": "i64"
        },
        {
          "name": "payDay",
          "type": "u8"
        },
        {
          "name": "cHash",
          "type": "string"
        }
      ]
    },
    {
      "name": "delistProperty",
      "discriminator": [
        239,
        82,
        222,
        180,
        186,
        53,
        144,
        15
      ],
      "accounts": [
        {
          "name": "listing",
          "writable": true
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "initializePlatform",
      "discriminator": [
        119,
        201,
        101,
        45,
        75,
        122,
        89,
        3
      ],
      "accounts": [
        {
          "name": "platform",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  116,
                  102,
                  111,
                  114,
                  109
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "feeReceiver"
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "listFee",
          "type": "u64"
        },
        {
          "name": "cFee",
          "type": "u64"
        },
        {
          "name": "payFee",
          "type": "u64"
        }
      ]
    },
    {
      "name": "listProperty",
      "discriminator": [
        254,
        101,
        42,
        174,
        220,
        160,
        42,
        82
      ],
      "accounts": [
        {
          "name": "platform",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  116,
                  102,
                  111,
                  114,
                  109
                ]
              }
            ]
          }
        },
        {
          "name": "listing",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  105,
                  115,
                  116,
                  105,
                  110,
                  103
                ]
              },
              {
                "kind": "arg",
                "path": "attestPda"
              }
            ]
          }
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "ownerUsdc",
          "writable": true
        },
        {
          "name": "platUsdc",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "clock",
          "address": "SysvarC1ock11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "attestPda",
          "type": "pubkey"
        },
        {
          "name": "mRent",
          "type": "u64"
        },
        {
          "name": "depMonths",
          "type": "u8"
        },
        {
          "name": "details",
          "type": "string"
        }
      ]
    },
    {
      "name": "payRent",
      "discriminator": [
        69,
        155,
        112,
        183,
        178,
        234,
        94,
        100
      ],
      "accounts": [
        {
          "name": "platform",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  116,
                  102,
                  111,
                  114,
                  109
                ]
              }
            ]
          }
        },
        {
          "name": "contract",
          "writable": true
        },
        {
          "name": "tenant",
          "writable": true,
          "signer": true
        },
        {
          "name": "tUsdc",
          "writable": true
        },
        {
          "name": "lUsdc",
          "writable": true
        },
        {
          "name": "platUsdc",
          "writable": true
        },
        {
          "name": "paymentRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "contract"
              },
              {
                "kind": "arg",
                "path": "payMonth"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "clock",
          "address": "SysvarC1ock11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "payMonth",
          "type": "string"
        }
      ]
    },
    {
      "name": "rejectApplication",
      "discriminator": [
        85,
        73,
        224,
        47,
        9,
        184,
        39,
        217
      ],
      "accounts": [
        {
          "name": "listing"
        },
        {
          "name": "application",
          "writable": true
        },
        {
          "name": "applicant"
        },
        {
          "name": "owner",
          "signer": true
        },
        {
          "name": "clock",
          "address": "SysvarC1ock11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "reportDispute",
      "discriminator": [
        229,
        114,
        46,
        235,
        151,
        188,
        5,
        142
      ],
      "accounts": [
        {
          "name": "contract"
        },
        {
          "name": "dispute",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  105,
                  115,
                  112,
                  117,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "contract"
              },
              {
                "kind": "account",
                "path": "initiator"
              }
            ]
          }
        },
        {
          "name": "initiator",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "clock",
          "address": "SysvarC1ock11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "reason",
          "type": "string"
        },
        {
          "name": "eHash",
          "type": "string"
        }
      ]
    },
    {
      "name": "respondDispute",
      "discriminator": [
        71,
        136,
        87,
        127,
        213,
        117,
        241,
        1
      ],
      "accounts": [
        {
          "name": "dispute",
          "writable": true
        },
        {
          "name": "respondent",
          "signer": true
        },
        {
          "name": "clock",
          "address": "SysvarC1ock11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "rHash",
          "type": "string"
        }
      ]
    },
    {
      "name": "signContract",
      "discriminator": [
        145,
        83,
        234,
        177,
        104,
        87,
        183,
        156
      ],
      "accounts": [
        {
          "name": "platform",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  116,
                  102,
                  111,
                  114,
                  109
                ]
              }
            ]
          }
        },
        {
          "name": "listing",
          "writable": true
        },
        {
          "name": "contract",
          "writable": true
        },
        {
          "name": "tenant",
          "writable": true,
          "signer": true
        },
        {
          "name": "tUsdc",
          "writable": true
        },
        {
          "name": "lUsdc",
          "writable": true
        },
        {
          "name": "escrowUsdc",
          "writable": true
        },
        {
          "name": "escrowPda",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "contract"
              }
            ]
          }
        },
        {
          "name": "platUsdc",
          "writable": true
        },
        {
          "name": "paymentRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "contract"
              },
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  105,
                  116,
                  105,
                  97,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "clock",
          "address": "SysvarC1ock11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "terminateContract",
      "discriminator": [
        39,
        195,
        134,
        151,
        240,
        183,
        194,
        205
      ],
      "accounts": [
        {
          "name": "listing",
          "writable": true
        },
        {
          "name": "contract",
          "writable": true
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "contract"
              }
            ]
          }
        },
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "escrowUsdc",
          "writable": true
        },
        {
          "name": "tUsdc",
          "writable": true
        },
        {
          "name": "refundRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "contract"
              },
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  102,
                  117,
                  110,
                  100
                ]
              }
            ]
          }
        },
        {
          "name": "escrowPda",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "contract"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "clock",
          "address": "SysvarC1ock11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "reason",
          "type": "string"
        }
      ]
    },
    {
      "name": "withdrawFees",
      "discriminator": [
        198,
        212,
        171,
        109,
        144,
        215,
        174,
        89
      ],
      "accounts": [
        {
          "name": "platform",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  116,
                  102,
                  111,
                  114,
                  109
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "platUsdc",
          "writable": true
        },
        {
          "name": "recipientUsdc",
          "writable": true
        },
        {
          "name": "feeReceiver",
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "disputeRecord",
      "discriminator": [
        198,
        199,
        79,
        209,
        12,
        215,
        34,
        47
      ]
    },
    {
      "name": "escrowAccount",
      "discriminator": [
        36,
        69,
        48,
        18,
        128,
        225,
        125,
        135
      ]
    },
    {
      "name": "paymentRecord",
      "discriminator": [
        202,
        168,
        56,
        249,
        127,
        226,
        86,
        226
      ]
    },
    {
      "name": "platform",
      "discriminator": [
        77,
        92,
        204,
        58,
        187,
        98,
        91,
        12
      ]
    },
    {
      "name": "propertyListing",
      "discriminator": [
        174,
        25,
        33,
        12,
        133,
        179,
        107,
        36
      ]
    },
    {
      "name": "rentalApplication",
      "discriminator": [
        79,
        198,
        211,
        18,
        226,
        157,
        162,
        22
      ]
    },
    {
      "name": "rentalContract",
      "discriminator": [
        45,
        116,
        9,
        6,
        145,
        34,
        166,
        125
      ]
    }
  ],
  "events": [
    {
      "name": "contractSigned",
      "discriminator": [
        41,
        58,
        198,
        149,
        37,
        119,
        227,
        182
      ]
    },
    {
      "name": "disputeRaised",
      "discriminator": [
        246,
        167,
        109,
        37,
        142,
        45,
        38,
        176
      ]
    },
    {
      "name": "disputeResolved",
      "discriminator": [
        121,
        64,
        249,
        153,
        139,
        128,
        236,
        187
      ]
    },
    {
      "name": "propertyListed",
      "discriminator": [
        33,
        100,
        200,
        151,
        150,
        150,
        33,
        145
      ]
    },
    {
      "name": "rentPaid",
      "discriminator": [
        140,
        29,
        172,
        69,
        152,
        38,
        73,
        241
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "platformNotInitialized",
      "msg": ""
    },
    {
      "code": 6001,
      "name": "invalidFeeAmount",
      "msg": ""
    },
    {
      "code": 6002,
      "name": "invalidAttestation",
      "msg": ""
    },
    {
      "code": 6003,
      "name": "invalidListingStatus",
      "msg": ""
    },
    {
      "code": 6004,
      "name": "notPropertyOwner",
      "msg": ""
    },
    {
      "code": 6005,
      "name": "invalidApplicationStatus",
      "msg": ""
    },
    {
      "code": 6006,
      "name": "invalidContractStatus",
      "msg": ""
    },
    {
      "code": 6007,
      "name": "notContractParty",
      "msg": ""
    },
    {
      "code": 6008,
      "name": "invalidPaymentDay",
      "msg": ""
    },
    {
      "code": 6009,
      "name": "contractStartDateMustBeFuture",
      "msg": ""
    },
    {
      "code": 6010,
      "name": "contractEndDateMustBeAfterStart",
      "msg": ""
    },
    {
      "code": 6011,
      "name": "depositMustBeGreaterThanZero",
      "msg": ""
    },
    {
      "code": 6012,
      "name": "rentMustBeGreaterThanZero",
      "msg": ""
    },
    {
      "code": 6013,
      "name": "contractNotStarted",
      "msg": ""
    },
    {
      "code": 6014,
      "name": "contractEnded",
      "msg": ""
    },
    {
      "code": 6015,
      "name": "depositAlreadyRefunded",
      "msg": ""
    },
    {
      "code": 6016,
      "name": "unauthorized",
      "msg": ""
    },
    {
      "code": 6017,
      "name": "insufficientBalance",
      "msg": ""
    },
    {
      "code": 6018,
      "name": "invalidWithdrawAmount",
      "msg": ""
    },
    {
      "code": 6019,
      "name": "stringTooLong",
      "msg": ""
    },
    {
      "code": 6020,
      "name": "invalidDisputeStatus",
      "msg": ""
    },
    {
      "code": 6021,
      "name": "invalidCounterOffer",
      "msg": ""
    },
    {
      "code": 6022,
      "name": "tooManyCounters",
      "msg": ""
    },
    {
      "code": 6023,
      "name": "mustAcceptApplicantOffer",
      "msg": ""
    }
  ],
  "types": [
    {
      "name": "applicationStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "pending"
          },
          {
            "name": "negotiating"
          },
          {
            "name": "accepted"
          },
          {
            "name": "rejected"
          },
          {
            "name": "expired"
          }
        ]
      }
    },
    {
      "name": "contractSigned",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "contract",
            "type": "pubkey"
          },
          {
            "name": "landlord",
            "type": "pubkey"
          },
          {
            "name": "tenant",
            "type": "pubkey"
          },
          {
            "name": "totalPayment",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "contractStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "pendingSignature"
          },
          {
            "name": "active"
          },
          {
            "name": "completed"
          },
          {
            "name": "terminated"
          }
        ]
      }
    },
    {
      "name": "disputeRaised",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "disputeId",
            "type": "pubkey"
          },
          {
            "name": "contract",
            "type": "pubkey"
          },
          {
            "name": "initiator",
            "type": "pubkey"
          },
          {
            "name": "reason",
            "type": "string"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "disputeRecord",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "type": "pubkey"
          },
          {
            "name": "contract",
            "type": "pubkey"
          },
          {
            "name": "initiator",
            "type": "pubkey"
          },
          {
            "name": "respondent",
            "type": "pubkey"
          },
          {
            "name": "reason",
            "type": "string"
          },
          {
            "name": "eHash",
            "type": "string"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "disputeStatus"
              }
            }
          },
          {
            "name": "created",
            "type": "i64"
          },
          {
            "name": "updated",
            "type": "i64"
          },
          {
            "name": "notes",
            "type": {
              "option": "string"
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "disputeResolved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "disputeId",
            "type": "pubkey"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "disputeStatus"
              }
            }
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "disputeStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "open"
          },
          {
            "name": "underReview"
          },
          {
            "name": "resolved"
          },
          {
            "name": "withdrawn"
          }
        ]
      }
    },
    {
      "name": "escrowAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "contract",
            "type": "pubkey"
          },
          {
            "name": "deposit",
            "type": "u64"
          },
          {
            "name": "refunded",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "listingStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "available"
          },
          {
            "name": "rented"
          },
          {
            "name": "delisted"
          }
        ]
      }
    },
    {
      "name": "paymentRecord",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "contract",
            "type": "pubkey"
          },
          {
            "name": "payer",
            "type": "pubkey"
          },
          {
            "name": "recipient",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "payType",
            "type": {
              "defined": {
                "name": "paymentType"
              }
            }
          },
          {
            "name": "payMonth",
            "type": {
              "option": "string"
            }
          },
          {
            "name": "txTime",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "paymentType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "deposit"
          },
          {
            "name": "firstMonthRent"
          },
          {
            "name": "monthlyRent"
          },
          {
            "name": "platformFee"
          },
          {
            "name": "depositRefund"
          }
        ]
      }
    },
    {
      "name": "platform",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "feeReceiver",
            "type": "pubkey"
          },
          {
            "name": "usdcMint",
            "type": "pubkey"
          },
          {
            "name": "listFee",
            "type": "u64"
          },
          {
            "name": "cFee",
            "type": "u64"
          },
          {
            "name": "payFee",
            "type": "u64"
          },
          {
            "name": "isInitialized",
            "type": "bool"
          },
          {
            "name": "totalFees",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "propertyListed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "listing",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "propertyId",
            "type": "string"
          },
          {
            "name": "mRent",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "propertyListing",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "attestPda",
            "type": "pubkey"
          },
          {
            "name": "mRent",
            "type": "u64"
          },
          {
            "name": "depMonths",
            "type": "u8"
          },
          {
            "name": "details",
            "type": "string"
          },
          {
            "name": "curContract",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "listingStatus"
              }
            }
          },
          {
            "name": "created",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "rentPaid",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "contract",
            "type": "pubkey"
          },
          {
            "name": "tenant",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "payMonth",
            "type": "string"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "rentalApplication",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "listing",
            "type": "pubkey"
          },
          {
            "name": "applicant",
            "type": "pubkey"
          },
          {
            "name": "attestPda",
            "type": "pubkey"
          },
          {
            "name": "offerRent",
            "type": "u64"
          },
          {
            "name": "offerDeposit",
            "type": "u64"
          },
          {
            "name": "offerHash",
            "type": "string"
          },
          {
            "name": "counter",
            "type": "u8"
          },
          {
            "name": "lastActor",
            "type": "pubkey"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "applicationStatus"
              }
            }
          },
          {
            "name": "created",
            "type": "i64"
          },
          {
            "name": "updated",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "rentalContract",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "listing",
            "type": "pubkey"
          },
          {
            "name": "landlord",
            "type": "pubkey"
          },
          {
            "name": "tenant",
            "type": "pubkey"
          },
          {
            "name": "mRent",
            "type": "u64"
          },
          {
            "name": "deposit",
            "type": "u64"
          },
          {
            "name": "start",
            "type": "i64"
          },
          {
            "name": "end",
            "type": "i64"
          },
          {
            "name": "payDay",
            "type": "u8"
          },
          {
            "name": "cHash",
            "type": "string"
          },
          {
            "name": "escrow",
            "type": "pubkey"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "contractStatus"
              }
            }
          },
          {
            "name": "paidM",
            "type": "u16"
          },
          {
            "name": "created",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
