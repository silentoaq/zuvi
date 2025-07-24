/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/zuvi.json`.
 */
export type Zuvi = {
  "address": "2h2Gw1oK7zNHed7GBXFShqvJGzBaVkPEMB7EDRUcVdct",
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
      "name": "applyForRental",
      "discriminator": [
        61,
        26,
        207,
        110,
        237,
        183,
        191,
        74
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
          "name": "applicantAttestation",
          "type": "string"
        },
        {
          "name": "proposedTerms",
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
          "name": "escrowAccount",
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
          "name": "startDate",
          "type": "i64"
        },
        {
          "name": "endDate",
          "type": "i64"
        },
        {
          "name": "paymentDay",
          "type": "u8"
        },
        {
          "name": "contractHash",
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
          "name": "listingFee",
          "type": "u64"
        },
        {
          "name": "contractFee",
          "type": "u64"
        },
        {
          "name": "paymentFee",
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
                "path": "propertyId"
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
          "name": "ownerUsdcAccount",
          "writable": true
        },
        {
          "name": "platformUsdcAccount",
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
          "name": "propertyId",
          "type": "string"
        },
        {
          "name": "ownerAttestation",
          "type": "string"
        },
        {
          "name": "monthlyRent",
          "type": "u64"
        },
        {
          "name": "depositMonths",
          "type": "u8"
        },
        {
          "name": "propertyDetailsHash",
          "type": "string"
        }
      ]
    },
    {
      "name": "payMonthlyRent",
      "discriminator": [
        144,
        48,
        219,
        104,
        253,
        102,
        160,
        11
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
          "name": "tenantUsdcAccount",
          "writable": true
        },
        {
          "name": "landlordUsdcAccount",
          "writable": true
        },
        {
          "name": "platformUsdcAccount",
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
                "path": "paymentMonth"
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
          "name": "paymentMonth",
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
          "name": "disputeRecord",
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
          "name": "evidenceHash",
          "type": "string"
        }
      ]
    },
    {
      "name": "respondToDispute",
      "discriminator": [
        212,
        2,
        194,
        244,
        37,
        73,
        173,
        201
      ],
      "accounts": [
        {
          "name": "disputeRecord",
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
          "name": "responseEvidenceHash",
          "type": "string"
        }
      ]
    },
    {
      "name": "signContractAndPay",
      "discriminator": [
        215,
        129,
        7,
        181,
        238,
        118,
        172,
        195
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
          "name": "tenantUsdcAccount",
          "writable": true
        },
        {
          "name": "landlordUsdcAccount",
          "writable": true
        },
        {
          "name": "escrowTokenAccount",
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
          "name": "platformUsdcAccount",
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
          "name": "escrowAccount",
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
          "name": "escrowTokenAccount",
          "writable": true
        },
        {
          "name": "tenantUsdcAccount",
          "writable": true
        },
        {
          "name": "refundPaymentRecord",
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
          "name": "escrowAuthority",
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
          "name": "platformUsdcAccount",
          "writable": true
        },
        {
          "name": "recipientUsdcAccount",
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
      "name": "platformAlreadyInitialized",
      "msg": ""
    },
    {
      "code": 6001,
      "name": "platformNotInitialized",
      "msg": ""
    },
    {
      "code": 6002,
      "name": "invalidFeeAmount",
      "msg": ""
    },
    {
      "code": 6003,
      "name": "invalidPropertyId",
      "msg": "無效房產 ID"
    },
    {
      "code": 6004,
      "name": "invalidAttestation",
      "msg": ""
    },
    {
      "code": 6005,
      "name": "propertyAlreadyListed",
      "msg": ""
    },
    {
      "code": 6006,
      "name": "listingNotFound",
      "msg": ""
    },
    {
      "code": 6007,
      "name": "invalidListingStatus",
      "msg": ""
    },
    {
      "code": 6008,
      "name": "notPropertyOwner",
      "msg": ""
    },
    {
      "code": 6009,
      "name": "applicationNotFound",
      "msg": ""
    },
    {
      "code": 6010,
      "name": "invalidApplicationStatus",
      "msg": ""
    },
    {
      "code": 6011,
      "name": "notApplicant",
      "msg": ""
    },
    {
      "code": 6012,
      "name": "contractNotFound",
      "msg": ""
    },
    {
      "code": 6013,
      "name": "invalidContractStatus",
      "msg": ""
    },
    {
      "code": 6014,
      "name": "notContractParty",
      "msg": ""
    },
    {
      "code": 6015,
      "name": "invalidPaymentDay",
      "msg": ""
    },
    {
      "code": 6016,
      "name": "invalidContractDuration",
      "msg": ""
    },
    {
      "code": 6017,
      "name": "contractStartDateMustBeFuture",
      "msg": ""
    },
    {
      "code": 6018,
      "name": "contractEndDateMustBeAfterStart",
      "msg": ""
    },
    {
      "code": 6019,
      "name": "depositMustBeGreaterThanZero",
      "msg": ""
    },
    {
      "code": 6020,
      "name": "rentMustBeGreaterThanZero",
      "msg": ""
    },
    {
      "code": 6021,
      "name": "incorrectPaymentAmount",
      "msg": ""
    },
    {
      "code": 6022,
      "name": "rentAlreadyPaidForMonth",
      "msg": ""
    },
    {
      "code": 6023,
      "name": "contractNotStarted",
      "msg": ""
    },
    {
      "code": 6024,
      "name": "contractEnded",
      "msg": ""
    },
    {
      "code": 6025,
      "name": "depositAlreadyRefunded",
      "msg": ""
    },
    {
      "code": 6026,
      "name": "unpaidRentExists",
      "msg": ""
    },
    {
      "code": 6027,
      "name": "unauthorized",
      "msg": ""
    },
    {
      "code": 6028,
      "name": "insufficientBalance",
      "msg": ""
    },
    {
      "code": 6029,
      "name": "invalidWithdrawAmount",
      "msg": ""
    },
    {
      "code": 6030,
      "name": "stringTooLong",
      "msg": ""
    },
    {
      "code": 6031,
      "name": "invalidDisputeStatus",
      "msg": ""
    },
    {
      "code": 6032,
      "name": "disputeAlreadyExists",
      "msg": ""
    },
    {
      "code": 6033,
      "name": "disputeNotFound",
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
            "name": "accepted"
          },
          {
            "name": "rejected"
          },
          {
            "name": "cancelled"
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
            "name": "initiatedBy",
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
            "name": "disputeId",
            "type": "pubkey"
          },
          {
            "name": "contract",
            "type": "pubkey"
          },
          {
            "name": "initiatedBy",
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
            "name": "evidenceHash",
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
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "updatedAt",
            "type": "i64"
          },
          {
            "name": "resolutionNotes",
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
            "name": "depositAmount",
            "type": "u64"
          },
          {
            "name": "depositRefunded",
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
            "name": "paymentType",
            "type": {
              "defined": {
                "name": "paymentType"
              }
            }
          },
          {
            "name": "paymentMonth",
            "type": {
              "option": "string"
            }
          },
          {
            "name": "timestamp",
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
            "name": "listingFee",
            "type": "u64"
          },
          {
            "name": "contractFee",
            "type": "u64"
          },
          {
            "name": "paymentFee",
            "type": "u64"
          },
          {
            "name": "isInitialized",
            "type": "bool"
          },
          {
            "name": "totalFeesCollected",
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
            "name": "monthlyRent",
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
            "name": "propertyId",
            "type": "string"
          },
          {
            "name": "ownerAttestation",
            "type": "string"
          },
          {
            "name": "monthlyRent",
            "type": "u64"
          },
          {
            "name": "depositMonths",
            "type": "u8"
          },
          {
            "name": "propertyDetailsHash",
            "type": "string"
          },
          {
            "name": "currentContract",
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
            "name": "createdAt",
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
            "name": "paymentMonth",
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
            "name": "applicantAttestation",
            "type": "string"
          },
          {
            "name": "proposedTerms",
            "type": "string"
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
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "updatedAt",
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
            "name": "monthlyRent",
            "type": "u64"
          },
          {
            "name": "depositAmount",
            "type": "u64"
          },
          {
            "name": "startDate",
            "type": "i64"
          },
          {
            "name": "endDate",
            "type": "i64"
          },
          {
            "name": "paymentDay",
            "type": "u8"
          },
          {
            "name": "contractHash",
            "type": "string"
          },
          {
            "name": "escrowAccount",
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
            "name": "paidMonths",
            "type": "u16"
          },
          {
            "name": "createdAt",
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
