/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/zuvi.json`.
 */
export type Zuvi = {
  "address": "2Mipufx8cUUVUD5bqZjGK2yFWvjVM4jBaKVmw9zD5hzP",
  "metadata": {
    "name": "zuvi",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "applyLease",
      "docs": [
        "申請租賃",
        "提交租賃申請和相關資料"
      ],
      "discriminator": [
        81,
        96,
        246,
        245,
        175,
        150,
        197,
        122
      ],
      "accounts": [
        {
          "name": "listing",
          "docs": [
            "房源列表帳戶"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  105,
                  115,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "listing.property_attest",
                "account": "listing"
              }
            ]
          }
        },
        {
          "name": "application",
          "docs": [
            "申請帳戶"
          ],
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
                  121
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
          "docs": [
            "申請人（支付者）"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "tenantAttest",
          "docs": [
            "承租人憑證帳戶"
          ]
        },
        {
          "name": "systemProgram",
          "docs": [
            "系統程式"
          ],
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "messageUri",
          "type": {
            "array": [
              "u8",
              46
            ]
          }
        }
      ]
    },
    {
      "name": "approveApplication",
      "docs": [
        "核准申請",
        "房東核准特定申請人"
      ],
      "discriminator": [
        136,
        47,
        9,
        33,
        208,
        120,
        226,
        157
      ],
      "accounts": [
        {
          "name": "listing",
          "docs": [
            "房源列表帳戶"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  105,
                  115,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "listing.property_attest",
                "account": "listing"
              }
            ]
          }
        },
        {
          "name": "application",
          "docs": [
            "申請帳戶"
          ],
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
                  121
                ]
              },
              {
                "kind": "account",
                "path": "listing"
              },
              {
                "kind": "account",
                "path": "application.applicant",
                "account": "application"
              }
            ]
          }
        },
        {
          "name": "owner",
          "docs": [
            "房東"
          ],
          "signer": true
        }
      ],
      "args": [
        {
          "name": "applicant",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "confirmRelease",
      "docs": [
        "確認押金結算",
        "另一方確認押金分配"
      ],
      "discriminator": [
        181,
        157,
        89,
        7,
        37,
        54,
        72,
        90
      ],
      "accounts": [
        {
          "name": "config",
          "docs": [
            "系統配置"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "lease",
          "docs": [
            "租約"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  97,
                  115,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "lease.listing",
                "account": "lease"
              },
              {
                "kind": "account",
                "path": "lease.tenant",
                "account": "lease"
              }
            ]
          }
        },
        {
          "name": "escrow",
          "docs": [
            "押金託管帳戶"
          ],
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
                "path": "lease"
              }
            ]
          }
        },
        {
          "name": "signer",
          "docs": [
            "確認人（房東或承租人）"
          ],
          "signer": true
        },
        {
          "name": "escrowToken",
          "docs": [
            "Escrow Token 帳戶"
          ],
          "writable": true
        },
        {
          "name": "landlordToken",
          "docs": [
            "房東 Token 帳戶"
          ],
          "writable": true
        },
        {
          "name": "tenantToken",
          "docs": [
            "承租人 Token 帳戶"
          ],
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "createLease",
      "docs": [
        "創建租約",
        "房東發起租約，設定條款"
      ],
      "discriminator": [
        158,
        42,
        229,
        17,
        202,
        87,
        68,
        148
      ],
      "accounts": [
        {
          "name": "listing",
          "docs": [
            "房源列表帳戶"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  105,
                  115,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "listing.property_attest",
                "account": "listing"
              }
            ]
          }
        },
        {
          "name": "application",
          "docs": [
            "申請帳戶（用於驗證）"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  112,
                  112,
                  108,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "listing"
              },
              {
                "kind": "account",
                "path": "application.applicant",
                "account": "application"
              }
            ]
          }
        },
        {
          "name": "lease",
          "docs": [
            "租約帳戶"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  97,
                  115,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "listing"
              },
              {
                "kind": "account",
                "path": "application.applicant",
                "account": "application"
              }
            ]
          }
        },
        {
          "name": "landlord",
          "docs": [
            "房東（支付者）"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "docs": [
            "系統程式"
          ],
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "applicant",
          "type": "pubkey"
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
          "name": "contractUri",
          "type": {
            "array": [
              "u8",
              46
            ]
          }
        }
      ]
    },
    {
      "name": "createListing",
      "docs": [
        "創建房源列表",
        "需要 API 簽名，驗證產權憑證後創建"
      ],
      "discriminator": [
        18,
        168,
        45,
        24,
        191,
        31,
        117,
        54
      ],
      "accounts": [
        {
          "name": "config",
          "docs": [
            "系統配置"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "listing",
          "docs": [
            "房源列表帳戶"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  105,
                  115,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "propertyAttest"
              }
            ]
          }
        },
        {
          "name": "owner",
          "docs": [
            "房東（支付者）"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "apiSigner",
          "docs": [
            "API 簽名者"
          ],
          "signer": true
        },
        {
          "name": "propertyAttest",
          "docs": [
            "產權憑證帳戶"
          ]
        },
        {
          "name": "systemProgram",
          "docs": [
            "系統程式"
          ],
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "address",
          "type": {
            "array": [
              "u8",
              64
            ]
          }
        },
        {
          "name": "buildingArea",
          "type": "u32"
        },
        {
          "name": "rent",
          "type": "u64"
        },
        {
          "name": "deposit",
          "type": "u64"
        },
        {
          "name": "metadataUri",
          "type": {
            "array": [
              "u8",
              46
            ]
          }
        }
      ]
    },
    {
      "name": "initialize",
      "docs": [
        "初始化系統配置",
        "設定 API 簽名者、仲裁者、費用接收者、USDC mint 和費率"
      ],
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "config",
          "docs": [
            "系統配置帳戶"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "docs": [
            "初始化授權者（支付者）"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "docs": [
            "系統程式"
          ],
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "apiSigner",
          "type": "pubkey"
        },
        {
          "name": "arbitrator",
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
          "name": "feeRate",
          "type": "u16"
        }
      ]
    },
    {
      "name": "initiateRelease",
      "docs": [
        "發起押金結算",
        "任一方發起押金分配方案"
      ],
      "discriminator": [
        207,
        117,
        219,
        170,
        61,
        0,
        71,
        211
      ],
      "accounts": [
        {
          "name": "lease",
          "docs": [
            "租約"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  97,
                  115,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "lease.listing",
                "account": "lease"
              },
              {
                "kind": "account",
                "path": "lease.tenant",
                "account": "lease"
              }
            ]
          }
        },
        {
          "name": "escrow",
          "docs": [
            "押金託管帳戶"
          ],
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
                "path": "lease"
              }
            ]
          }
        },
        {
          "name": "signer",
          "docs": [
            "發起人（房東或承租人）"
          ],
          "signer": true
        }
      ],
      "args": [
        {
          "name": "landlordAmount",
          "type": "u64"
        },
        {
          "name": "tenantAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "payRent",
      "docs": [
        "支付租金",
        "每月定期支付租金"
      ],
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
          "name": "config",
          "docs": [
            "系統配置"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "lease",
          "docs": [
            "租約"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  97,
                  115,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "lease.listing",
                "account": "lease"
              },
              {
                "kind": "account",
                "path": "lease.tenant",
                "account": "lease"
              }
            ]
          }
        },
        {
          "name": "tenant",
          "docs": [
            "承租人"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "tenantToken",
          "docs": [
            "承租人 Token 帳戶"
          ],
          "writable": true
        },
        {
          "name": "landlordToken",
          "docs": [
            "房東 Token 帳戶"
          ],
          "writable": true
        },
        {
          "name": "feeReceiverToken",
          "docs": [
            "平台費接收者 Token 帳戶"
          ],
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "raiseDispute",
      "docs": [
        "發起爭議",
        "對押金分配有異議時發起"
      ],
      "discriminator": [
        41,
        243,
        1,
        51,
        150,
        95,
        246,
        73
      ],
      "accounts": [
        {
          "name": "lease",
          "docs": [
            "租約"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  97,
                  115,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "lease.listing",
                "account": "lease"
              },
              {
                "kind": "account",
                "path": "lease.tenant",
                "account": "lease"
              }
            ]
          }
        },
        {
          "name": "escrow",
          "docs": [
            "押金託管帳戶"
          ],
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
                "path": "lease"
              }
            ]
          }
        },
        {
          "name": "dispute",
          "docs": [
            "爭議帳戶"
          ],
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
                "path": "lease"
              }
            ]
          }
        },
        {
          "name": "initiator",
          "docs": [
            "發起人（房東或承租人）"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "docs": [
            "系統程式"
          ],
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "reason",
          "type": "u8"
        }
      ]
    },
    {
      "name": "resolveDispute",
      "docs": [
        "解決爭議",
        "仲裁者裁決押金分配"
      ],
      "discriminator": [
        231,
        6,
        202,
        6,
        96,
        103,
        12,
        230
      ],
      "accounts": [
        {
          "name": "config",
          "docs": [
            "系統配置"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "lease",
          "docs": [
            "租約"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  97,
                  115,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "lease.listing",
                "account": "lease"
              },
              {
                "kind": "account",
                "path": "lease.tenant",
                "account": "lease"
              }
            ]
          }
        },
        {
          "name": "escrow",
          "docs": [
            "押金託管帳戶"
          ],
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
                "path": "lease"
              }
            ]
          }
        },
        {
          "name": "dispute",
          "docs": [
            "爭議帳戶"
          ],
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
                "path": "lease"
              }
            ]
          }
        },
        {
          "name": "arbitrator",
          "docs": [
            "仲裁者"
          ],
          "signer": true
        },
        {
          "name": "escrowToken",
          "docs": [
            "Escrow Token 帳戶"
          ],
          "writable": true
        },
        {
          "name": "landlordToken",
          "docs": [
            "房東 Token 帳戶"
          ],
          "writable": true
        },
        {
          "name": "tenantToken",
          "docs": [
            "承租人 Token 帳戶"
          ],
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "landlordAmount",
          "type": "u64"
        },
        {
          "name": "tenantAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "signLease",
      "docs": [
        "簽署租約",
        "承租人簽署並支付押金和首期租金"
      ],
      "discriminator": [
        135,
        105,
        78,
        179,
        51,
        45,
        115,
        174
      ],
      "accounts": [
        {
          "name": "config",
          "docs": [
            "系統配置"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "listing",
          "docs": [
            "房源列表"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  105,
                  115,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "listing.property_attest",
                "account": "listing"
              }
            ]
          }
        },
        {
          "name": "lease",
          "docs": [
            "租約"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  97,
                  115,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "listing"
              },
              {
                "kind": "account",
                "path": "lease.tenant",
                "account": "lease"
              }
            ]
          }
        },
        {
          "name": "escrow",
          "docs": [
            "押金託管帳戶"
          ],
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
                "path": "lease"
              }
            ]
          }
        },
        {
          "name": "tenant",
          "docs": [
            "承租人"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "tenantToken",
          "docs": [
            "承租人 Token 帳戶"
          ],
          "writable": true
        },
        {
          "name": "landlordToken",
          "docs": [
            "房東 Token 帳戶"
          ],
          "writable": true
        },
        {
          "name": "feeReceiverToken",
          "docs": [
            "平台費接收者 Token 帳戶"
          ],
          "writable": true
        },
        {
          "name": "escrowToken",
          "docs": [
            "Escrow Token 帳戶 (PDA)"
          ],
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
                  119,
                  95,
                  116,
                  111,
                  107,
                  101,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "lease"
              }
            ]
          }
        },
        {
          "name": "usdcMint",
          "docs": [
            "USDC Mint"
          ]
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
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "toggleListing",
      "docs": [
        "切換房源狀態",
        "在可用和下架之間切換"
      ],
      "discriminator": [
        143,
        108,
        89,
        47,
        54,
        242,
        47,
        220
      ],
      "accounts": [
        {
          "name": "listing",
          "docs": [
            "房源列表帳戶"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  105,
                  115,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "listing.property_attest",
                "account": "listing"
              }
            ]
          }
        },
        {
          "name": "owner",
          "docs": [
            "房東"
          ],
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "updateListing",
      "docs": [
        "更新房源資訊",
        "只能更新未出租的房源"
      ],
      "discriminator": [
        192,
        174,
        210,
        68,
        116,
        40,
        242,
        253
      ],
      "accounts": [
        {
          "name": "listing",
          "docs": [
            "房源列表帳戶"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  105,
                  115,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "listing.property_attest",
                "account": "listing"
              }
            ]
          }
        },
        {
          "name": "owner",
          "docs": [
            "房東"
          ],
          "signer": true
        }
      ],
      "args": [
        {
          "name": "rent",
          "type": {
            "option": "u64"
          }
        },
        {
          "name": "deposit",
          "type": {
            "option": "u64"
          }
        },
        {
          "name": "metadataUri",
          "type": {
            "option": {
              "array": [
                "u8",
                46
              ]
            }
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "application",
      "discriminator": [
        219,
        9,
        27,
        113,
        208,
        126,
        203,
        30
      ]
    },
    {
      "name": "config",
      "discriminator": [
        155,
        12,
        170,
        224,
        30,
        250,
        204,
        130
      ]
    },
    {
      "name": "dispute",
      "discriminator": [
        36,
        49,
        241,
        67,
        40,
        36,
        241,
        74
      ]
    },
    {
      "name": "escrow",
      "discriminator": [
        31,
        213,
        123,
        187,
        186,
        22,
        218,
        155
      ]
    },
    {
      "name": "lease",
      "discriminator": [
        14,
        103,
        218,
        61,
        248,
        234,
        105,
        84
      ]
    },
    {
      "name": "listing",
      "discriminator": [
        218,
        32,
        50,
        73,
        43,
        134,
        26,
        58
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "notInitialized",
      "msg": "E001: 系統尚未初始化"
    },
    {
      "code": 6001,
      "name": "unauthorized",
      "msg": "E002: 無權限執行此操作"
    },
    {
      "code": 6002,
      "name": "listingAlreadyRented",
      "msg": "E003: 房源已出租"
    },
    {
      "code": 6003,
      "name": "invalidApplication",
      "msg": "E004: 申請不存在或狀態不正確"
    },
    {
      "code": 6004,
      "name": "leaseNotActive",
      "msg": "E005: 租約未生效"
    },
    {
      "code": 6005,
      "name": "notSigned",
      "msg": "E006: 尚未簽署"
    },
    {
      "code": 6006,
      "name": "alreadySigned",
      "msg": "E007: 已經簽署"
    },
    {
      "code": 6007,
      "name": "disputeInProgress",
      "msg": "E008: 爭議進行中，無法執行"
    },
    {
      "code": 6008,
      "name": "invalidParameter",
      "msg": "E009: 無效的參數"
    },
    {
      "code": 6009,
      "name": "apiSignatureRequired",
      "msg": "E010: 需要 API 簽名"
    },
    {
      "code": 6010,
      "name": "listingInactive",
      "msg": "E011: 房源已下架"
    },
    {
      "code": 6011,
      "name": "duplicateApplication",
      "msg": "E012: 重複申請"
    },
    {
      "code": 6012,
      "name": "leaseAlreadyExists",
      "msg": "E013: 租約已存在"
    },
    {
      "code": 6013,
      "name": "paymentNotDue",
      "msg": "E014: 支付日尚未到期"
    },
    {
      "code": 6014,
      "name": "leaseEnded",
      "msg": "E015: 租約已結束"
    },
    {
      "code": 6015,
      "name": "amountMismatch",
      "msg": "E016: 金額不匹配"
    },
    {
      "code": 6016,
      "name": "disputeAlreadyResolved",
      "msg": "E017: 爭議已解決"
    },
    {
      "code": 6017,
      "name": "notArbitrator",
      "msg": "E018: 非仲裁者"
    },
    {
      "code": 6018,
      "name": "depositAlreadyReleased",
      "msg": "E019: 押金已釋放"
    },
    {
      "code": 6019,
      "name": "invalidDate",
      "msg": "E020: 無效的日期"
    },
    {
      "code": 6020,
      "name": "invalidFeeRate",
      "msg": "E021: 無效的費率"
    },
    {
      "code": 6021,
      "name": "invalidDepositAmount",
      "msg": "E022: 無效的押金金額"
    },
    {
      "code": 6022,
      "name": "invalidPaymentDay",
      "msg": "E023: 無效的支付日"
    },
    {
      "code": 6023,
      "name": "invalidDisputeReason",
      "msg": "E024: 無效的爭議原因"
    },
    {
      "code": 6024,
      "name": "cannotApplyOwnListing",
      "msg": "E025: 無法對自己的房源申請"
    }
  ],
  "types": [
    {
      "name": "application",
      "docs": [
        "租賃申請帳戶"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "listing",
            "docs": [
              "申請的房源"
            ],
            "type": "pubkey"
          },
          {
            "name": "applicant",
            "docs": [
              "申請人公鑰"
            ],
            "type": "pubkey"
          },
          {
            "name": "tenantAttest",
            "docs": [
              "承租人憑證公鑰"
            ],
            "type": "pubkey"
          },
          {
            "name": "messageUri",
            "docs": [
              "IPFS Hash 存放申請資料"
            ],
            "type": {
              "array": [
                "u8",
                46
              ]
            }
          },
          {
            "name": "status",
            "docs": [
              "狀態: 0=待審, 1=核准, 2=拒絕"
            ],
            "type": "u8"
          },
          {
            "name": "createdAt",
            "docs": [
              "創建時間戳"
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "config",
      "docs": [
        "系統配置帳戶"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "apiSigner",
            "docs": [
              "API 簽名者公鑰"
            ],
            "type": "pubkey"
          },
          {
            "name": "arbitrator",
            "docs": [
              "仲裁者公鑰"
            ],
            "type": "pubkey"
          },
          {
            "name": "feeReceiver",
            "docs": [
              "平台費用接收者"
            ],
            "type": "pubkey"
          },
          {
            "name": "usdcMint",
            "docs": [
              "USDC SPL Token Mint"
            ],
            "type": "pubkey"
          },
          {
            "name": "feeRate",
            "docs": [
              "費率 (basis points, 100 = 1%)"
            ],
            "type": "u16"
          },
          {
            "name": "initialized",
            "docs": [
              "是否已初始化"
            ],
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "dispute",
      "docs": [
        "爭議帳戶"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "lease",
            "docs": [
              "關聯的租約"
            ],
            "type": "pubkey"
          },
          {
            "name": "initiator",
            "docs": [
              "發起人公鑰"
            ],
            "type": "pubkey"
          },
          {
            "name": "reason",
            "docs": [
              "爭議原因: 0=押金爭議, 1=其他"
            ],
            "type": "u8"
          },
          {
            "name": "status",
            "docs": [
              "狀態: 0=進行中, 1=已解決"
            ],
            "type": "u8"
          },
          {
            "name": "createdAt",
            "docs": [
              "創建時間戳"
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "escrow",
      "docs": [
        "押金託管帳戶"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "lease",
            "docs": [
              "關聯的租約"
            ],
            "type": "pubkey"
          },
          {
            "name": "amount",
            "docs": [
              "押金總額 (USDC lamports)"
            ],
            "type": "u64"
          },
          {
            "name": "status",
            "docs": [
              "狀態: 0=持有中, 1=釋放中, 2=已釋放"
            ],
            "type": "u8"
          },
          {
            "name": "releaseToLandlord",
            "docs": [
              "分配給房東的金額"
            ],
            "type": "u64"
          },
          {
            "name": "releaseToTenant",
            "docs": [
              "分配給承租人的金額"
            ],
            "type": "u64"
          },
          {
            "name": "landlordSigned",
            "docs": [
              "房東是否確認結算"
            ],
            "type": "bool"
          },
          {
            "name": "tenantSigned",
            "docs": [
              "承租人是否確認結算"
            ],
            "type": "bool"
          },
          {
            "name": "hasDispute",
            "docs": [
              "是否有爭議"
            ],
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "lease",
      "docs": [
        "租約帳戶"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "listing",
            "docs": [
              "關聯的房源"
            ],
            "type": "pubkey"
          },
          {
            "name": "landlord",
            "docs": [
              "房東公鑰"
            ],
            "type": "pubkey"
          },
          {
            "name": "tenant",
            "docs": [
              "承租人公鑰"
            ],
            "type": "pubkey"
          },
          {
            "name": "tenantAttest",
            "docs": [
              "承租人憑證"
            ],
            "type": "pubkey"
          },
          {
            "name": "rent",
            "docs": [
              "月租金 (USDC lamports)"
            ],
            "type": "u64"
          },
          {
            "name": "deposit",
            "docs": [
              "押金金額 (USDC lamports)"
            ],
            "type": "u64"
          },
          {
            "name": "startDate",
            "docs": [
              "開始日期 (Unix timestamp)"
            ],
            "type": "i64"
          },
          {
            "name": "endDate",
            "docs": [
              "結束日期 (Unix timestamp)"
            ],
            "type": "i64"
          },
          {
            "name": "paymentDay",
            "docs": [
              "每月繳費日 (1-28)"
            ],
            "type": "u8"
          },
          {
            "name": "paidMonths",
            "docs": [
              "已付月數"
            ],
            "type": "u32"
          },
          {
            "name": "lastPayment",
            "docs": [
              "上次付款時間"
            ],
            "type": "i64"
          },
          {
            "name": "contractUri",
            "docs": [
              "IPFS Hash 存放合約內容"
            ],
            "type": {
              "array": [
                "u8",
                46
              ]
            }
          },
          {
            "name": "status",
            "docs": [
              "狀態: 0=生效中, 1=已完成, 2=已終止"
            ],
            "type": "u8"
          },
          {
            "name": "landlordSigned",
            "docs": [
              "房東是否已簽署"
            ],
            "type": "bool"
          },
          {
            "name": "tenantSigned",
            "docs": [
              "承租人是否已簽署"
            ],
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "listing",
      "docs": [
        "房源列表帳戶"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "docs": [
              "房東公鑰"
            ],
            "type": "pubkey"
          },
          {
            "name": "propertyAttest",
            "docs": [
              "產權憑證公鑰"
            ],
            "type": "pubkey"
          },
          {
            "name": "address",
            "docs": [
              "房屋地址（來自憑證揭露）"
            ],
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          },
          {
            "name": "buildingArea",
            "docs": [
              "建物面積（來自憑證揭露）"
            ],
            "type": "u32"
          },
          {
            "name": "rent",
            "docs": [
              "月租金 (USDC lamports)"
            ],
            "type": "u64"
          },
          {
            "name": "deposit",
            "docs": [
              "押金金額 (USDC lamports)"
            ],
            "type": "u64"
          },
          {
            "name": "metadataUri",
            "docs": [
              "IPFS Hash 存放房源詳情"
            ],
            "type": {
              "array": [
                "u8",
                46
              ]
            }
          },
          {
            "name": "status",
            "docs": [
              "狀態: 0=可用, 1=已租, 2=下架"
            ],
            "type": "u8"
          },
          {
            "name": "currentTenant",
            "docs": [
              "當前承租人（如果有）"
            ],
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "createdAt",
            "docs": [
              "創建時間戳"
            ],
            "type": "i64"
          }
        ]
      }
    }
  ]
};
