import { NextResponse } from 'next/server'

import { x402Network } from '@/lib/config/chains'
import { siteConfig } from '@/lib/config/site'

export const dynamic = 'force-static'

export function GET() {
  return NextResponse.json({
    openapi: '3.1.0',
    info: {
      title: `${siteConfig.name} API`,
      version: '1.0.0',
      description:
        'PYUSD-native paid API marketplace and x402 gateway for the configured EVM network.'
    },
    servers: [
      {
        url: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
        description: 'API gateway'
      }
    ],
    tags: [
      { name: 'Marketplace' },
      { name: 'x402' },
      { name: 'Receipts' },
      { name: 'Agents' },
      { name: 'Proofs' },
      { name: 'Credits' },
      { name: 'Providers' },
      { name: 'Operations' }
    ],
    paths: {
      '/api/health': {
        get: {
          tags: ['Operations'],
          summary: 'Read gateway readiness checks',
          responses: {
            '200': {
              description: 'Operational readiness summary',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string' },
                      readyChecks: { type: 'number' },
                      attentionChecks: { type: 'number' },
                      checks: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/ReadinessCheck' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/orders': {
        post: {
          tags: ['Marketplace'],
          summary: 'Create a buyer order record',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateOrderRequest' }
              }
            }
          },
          responses: {
            '200': {
              description: 'Payment-required order',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Order' }
                }
              }
            },
            '400': { description: 'Invalid order payload' },
            '404': { description: 'Product not found' }
          }
        }
      },
      '/api/orders/{orderId}': {
        get: {
          tags: ['Marketplace'],
          summary: 'Get an order lifecycle record',
          parameters: [pathStringParameter('orderId')],
          responses: {
            '200': {
              description: 'Order lifecycle record',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Order' }
                }
              }
            },
            '404': { description: 'Order not found' }
          }
        }
      },
      '/api/orders/{orderId}/provider-status': {
        get: {
          tags: ['Marketplace'],
          summary: 'Poll a long-running provider job',
          parameters: [pathStringParameter('orderId')],
          responses: {
            '200': {
              description: 'Updated order and provider status payload',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ProviderStatusResponse'
                  }
                }
              }
            },
            '400': { description: 'Order is not pollable' },
            '404': { description: 'Order not found' }
          }
        }
      },
      '/api/x402/products/{slug}/call': {
        get: paidCallOperation('GET'),
        post: paidCallOperation('POST')
      },
      '/api/x402/orders/{orderId}/claim': {
        post: {
          tags: ['x402'],
          summary: 'Pay a metered delta and reveal a completed result',
          security: [{ x402Payment: [] }],
          parameters: [pathStringParameter('orderId')],
          responses: {
            '200': {
              description: 'Released provider result and delta receipt',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/PaidProductResponse' }
                }
              }
            },
            '400': { description: 'Order does not require a claim payment' },
            '402': { description: 'x402 PYUSD delta payment required' }
          }
        }
      },
      '/api/credits/accounts': {
        post: {
          tags: ['Credits'],
          summary: 'Create or read a managed credit account and API key',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreditAccountRequest' }
              }
            }
          },
          responses: {
            '200': {
              description: 'Managed credit account',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/CreditAccountResponse' }
                }
              }
            },
            '400': { description: 'Invalid account payload' }
          }
        }
      },
      '/api/credits/top-ups': {
        post: {
          tags: ['Credits'],
          summary: 'Record a PYUSD top-up for managed API-key usage',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreditTopUpRequest' }
              }
            }
          },
          responses: {
            '200': {
              description: 'Recorded top-up and updated account',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/CreditAccountResponse' }
                }
              }
            },
            '400': { description: 'Invalid top-up payload' }
          }
        }
      },
      '/api/credits/products/{slug}/call': {
        post: {
          tags: ['Credits'],
          summary: 'Call a product with managed credits and an API key',
          security: [{ managedCreditApiKey: [] }],
          parameters: [pathStringParameter('slug')],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { type: 'object', additionalProperties: true }
              }
            }
          },
          responses: {
            '200': {
              description: 'Provider response and managed-credit receipt',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/PaidProductResponse' }
                }
              }
            },
            '401': { description: 'Missing or invalid API key' },
            '402': { description: 'Managed credit balance is too low' }
          }
        }
      },
      '/api/providers/openapi/preview': {
        post: {
          tags: ['Providers'],
          summary: 'Preview paid API listings from OpenAPI',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/OpenApiImportRequest' }
              }
            }
          },
          responses: {
            '200': {
              description: 'OpenAPI operation candidates',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/OpenApiImportPreview' }
                }
              }
            },
            '400': { description: 'Invalid or unsupported OpenAPI document' }
          }
        }
      },
      '/api/providers/self/products': {
        post: {
          tags: ['Providers'],
          summary: 'Create a paid provider API product',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateProviderProduct' }
              }
            }
          },
          responses: {
            '200': { description: 'Provider product accepted' },
            '400': { description: 'Invalid product payload' },
            '401': { description: 'Wallet session required' },
            '403': { description: 'Completed profile required' },
            '409': { description: 'Product slug already exists' }
          }
        }
      },
      '/api/providers/self/products/bulk-delete': {
        post: {
          tags: ['Providers'],
          summary: 'Delete selected provider-created API products',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/BulkIdsRequest' }
              }
            }
          },
          responses: {
            '200': { description: 'Bulk delete result' },
            '400': { description: 'No product IDs selected' }
          }
        }
      },
      '/api/receipts/{receiptId}': {
        get: {
          tags: ['Receipts'],
          summary: 'Get a PYUSD settlement receipt',
          parameters: [
            {
              name: 'receiptId',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          responses: {
            '200': {
              description: 'Settlement receipt',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Receipt' }
                }
              }
            },
            '404': { description: 'Receipt not found' }
          }
        }
      },
      '/api/agents/runs': {
        get: {
          tags: ['Agents'],
          summary: 'List autonomous agent runs',
          responses: {
            '200': {
              description: 'Agent run list',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      runs: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/AgentRun' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        post: {
          tags: ['Agents'],
          summary: 'Create an autonomous agent run',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateAgentRunRequest' }
              }
            }
          },
          responses: {
            '200': {
              description: 'Planned agent run',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/AgentRun' }
                }
              }
            },
            '400': { description: 'Invalid agent run payload' }
          }
        }
      },
      '/api/agents/runs/{runId}': {
        get: {
          tags: ['Agents'],
          summary: 'Get autonomous agent run status',
          parameters: [pathStringParameter('runId')],
          responses: {
            '200': {
              description: 'Agent run',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/AgentRun' }
                }
              }
            },
            '404': { description: 'Agent run not found' }
          }
        },
        delete: {
          tags: ['Agents'],
          summary: 'Stop and delete an autonomous agent run',
          parameters: [pathStringParameter('runId')],
          responses: {
            '200': {
              description: 'Agent run deleted',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      deletedRunId: { type: 'string' },
                      stopped: { type: 'boolean' }
                    }
                  }
                }
              }
            },
            '404': { description: 'Agent run not found' }
          }
        }
      },
      '/api/agents/runs/bulk-delete': {
        post: {
          tags: ['Agents'],
          summary: 'Stop and delete selected autonomous agent runs',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/BulkIdsRequest' }
              }
            }
          },
          responses: {
            '200': { description: 'Bulk delete result' },
            '400': { description: 'No run IDs selected' }
          }
        }
      },
      '/api/agents/runs/{runId}/execute': {
        post: {
          tags: ['Agents'],
          summary: 'Execute paid actions for an autonomous agent run',
          parameters: [pathStringParameter('runId')],
          responses: {
            '200': {
              description: 'Executed agent run',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/AgentRun' }
                }
              }
            },
            '404': { description: 'Agent run not found' }
          }
        }
      },
      '/api/agents/runs/{runId}/funding/prepare': {
        post: {
          tags: ['Agents'],
          summary: 'Prepare a user-funded agent budget vault transaction',
          parameters: [pathStringParameter('runId')],
          responses: {
            '200': { description: 'Funding transaction details' },
            '404': { description: 'Agent run not found' },
            '412': { description: 'Agent vault not configured' }
          }
        }
      },
      '/api/agents/runs/{runId}/funding/confirm': {
        post: {
          tags: ['Agents'],
          summary: 'Confirm an agent budget vault funding transaction',
          parameters: [pathStringParameter('runId')],
          responses: {
            '200': {
              description: 'Funded agent run',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/AgentRun' }
                }
              }
            },
            '404': { description: 'Agent run not found' }
          }
        }
      },
      '/api/agents/runs/{runId}/refund': {
        post: {
          tags: ['Agents'],
          summary: 'Refund unused agent budget',
          parameters: [pathStringParameter('runId')],
          responses: {
            '200': {
              description: 'Refunded agent run',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/AgentRun' }
                }
              }
            },
            '404': { description: 'Agent run not found' }
          }
        }
      },
      '/api/agents/runs/{runId}/ledger': {
        get: {
          tags: ['Agents'],
          summary: 'Get agent budget ledger events',
          parameters: [pathStringParameter('runId')],
          responses: {
            '200': { description: 'Agent funding and spend ledger' },
            '404': { description: 'Agent run not found' }
          }
        }
      },
      '/api/agents/runs/{runId}/attest': {
        post: {
          tags: ['Agents'],
          summary: 'Attest an agent run proof hash on-chain',
          parameters: [pathStringParameter('runId')],
          responses: {
            '200': {
              description: 'Attested agent run',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/AgentRun' }
                }
              }
            },
            '404': { description: 'Agent run not found' }
          }
        }
      },
      '/api/proofs/{proofId}': {
        get: {
          tags: ['Proofs'],
          summary: 'Get a public agent run proof',
          parameters: [pathStringParameter('proofId')],
          responses: {
            '200': {
              description: 'Public agent proof',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/AgentProofResponse' }
                }
              }
            },
            '404': { description: 'Proof not found' }
          }
        }
      }
    },
    components: {
      securitySchemes: {
        x402Payment: {
          type: 'apiKey',
          in: 'header',
          name: 'X-PAYMENT',
          description:
            'Signed x402 payment payload generated by an x402 buyer client for PYUSD settlement on the configured EVM network.'
        },
        managedCreditApiKey: {
          type: 'http',
          scheme: 'bearer',
          description:
            'Managed-credit API key for teams that prefer prepaid API-key usage.'
        }
      },
      schemas: {
        CreditAccountRequest: {
          type: 'object',
          required: ['wallet'],
          properties: {
            wallet: { type: 'string' }
          }
        },
        CreditTopUpRequest: {
          type: 'object',
          required: ['wallet', 'amountUsdt', 'settlementTxHash'],
          properties: {
            wallet: { type: 'string' },
            amountUsdt: { type: 'number' },
            settlementTxHash: { type: 'string' }
          }
        },
        CreditAccountResponse: {
          type: 'object',
          properties: {
            account: { $ref: '#/components/schemas/CreditAccount' }
          }
        },
        CreditAccount: {
          type: 'object',
          properties: {
            wallet: { type: 'string' },
            apiKey: { type: 'string' },
            balanceUsdt: { type: 'string' },
            topUps: { type: 'array', items: { type: 'object' } },
            debits: { type: 'array', items: { type: 'object' } }
          }
        },
        OpenApiImportRequest: {
          type: 'object',
          properties: {
            specUrl: { type: 'string', format: 'uri' },
            specText: { type: 'string' },
            baseUrl: { type: 'string', format: 'uri' }
          }
        },
        OpenApiImportPreview: {
          type: 'object',
          properties: {
            info: { type: 'object', additionalProperties: true },
            candidates: {
              type: 'array',
              items: { type: 'object', additionalProperties: true }
            }
          }
        },
        CreateProviderProduct: {
          type: 'object',
          required: [
            'name',
            'slug',
            'category',
            'description',
            'priceUsd',
            'endpointUrl',
            'method',
            'requestSchemaJson',
            'responseSchemaJson'
          ],
          properties: {
            name: { type: 'string' },
            slug: { type: 'string' },
            category: { type: 'string' },
            description: { type: 'string' },
            priceUsd: { type: 'number' },
            endpointUrl: { type: 'string', format: 'uri' },
            method: { type: 'string', enum: ['GET', 'POST'] },
            authType: { type: 'string' },
            authSecret: { type: 'string' },
            executionMode: { type: 'string' },
            settlementModel: { type: 'string' },
            resultDelivery: { type: 'string' },
            statusEndpointUrl: { type: 'string', format: 'uri' },
            externalJobIdPath: { type: 'string' },
            statusPath: { type: 'string' },
            resultUrlPath: { type: 'string' },
            requestSchemaJson: { type: 'string' },
            responseSchemaJson: { type: 'string' },
            referencePayloadJson: { type: 'string' },
            isAgentReady: { type: 'boolean' }
          }
        },
        CreateOrderRequest: {
          type: 'object',
          required: ['productSlug', 'buyerWallet', 'requestPayloadJson'],
          properties: {
            productSlug: {
              type: 'string'
            },
            buyerWallet: { type: 'string' },
            requestPayloadJson: {
              oneOf: [{ type: 'string' }, { type: 'object' }]
            }
          }
        },
        Order: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            productSlug: { type: 'string' },
            productName: { type: 'string' },
            providerName: { type: 'string' },
            buyerWallet: { type: 'string' },
            status: { type: 'string' },
            amountUsdt: { type: 'string' },
            quotedCredits: { type: 'number' },
            quotedAmountUsdt: { type: 'string' },
            paidAmountUsdt: { type: 'string' },
            reservedAmountUsdt: { type: 'string' },
            actualCredits: { type: 'number' },
            actualAmountUsdt: { type: 'string' },
            deltaAmountUsdt: { type: 'string' },
            pricingSource: { type: 'string' },
            resultReleaseStatus: { type: 'string' },
            requestId: { type: 'string' },
            receiptId: { type: 'string' },
            explorerUrl: { type: 'string' },
            externalJobId: { type: 'string' },
            resultUrl: { type: 'string' },
            providerRequest: {
              type: 'object',
              additionalProperties: true,
              description:
                'Sanitized upstream provider request and response trace for diagnostics. Provider secrets are redacted.'
            },
            responsePayload: { type: 'object', additionalProperties: true }
          }
        },
        PaidProductResponse: {
          type: 'object',
          properties: {
            order: { $ref: '#/components/schemas/Order' },
            receipt: { $ref: '#/components/schemas/Receipt' },
            data: { type: 'object', additionalProperties: true }
          }
        },
        Receipt: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            orderId: { type: 'string' },
            requestId: { type: 'string' },
            productName: { type: 'string' },
            providerName: { type: 'string' },
            buyerWallet: { type: 'string' },
            providerWallet: { type: 'string' },
            amountUsdt: { type: 'string' },
            network: { type: 'string', enum: [x402Network] },
            txHash: { type: 'string' },
            explorerUrl: { type: 'string' }
          }
        },
        ProviderStatusResponse: {
          type: 'object',
          properties: {
            order: { $ref: '#/components/schemas/Order' },
            provider: {
              type: 'object',
              properties: {
                status: { type: 'string' },
                externalJobId: { type: 'string' },
                resultUrl: { type: 'string' },
                providerRequest: {
                  type: 'object',
                  additionalProperties: true
                },
                responsePayload: { type: 'object', additionalProperties: true },
                errorMessage: { type: 'string' }
              }
            }
          }
        },
        CreateAgentRunRequest: {
          type: 'object',
          required: [
            'objective',
            'ownerWallet',
            'budgetCapUsdt',
            'maxPaidActions'
          ],
          properties: {
            template: { type: 'string' },
            objective: { type: 'string' },
            sourceText: { type: 'string' },
            ownerWallet: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{40}$',
              description:
                'Connected wallet address that owns and funds the agent run.'
            },
            budgetCapUsdt: { type: 'number' },
            maxPaidActions: { type: 'number' },
            toolSelectionMode: {
              type: 'string',
              enum: ['ai', 'manual'],
              description:
                'ai lets the backend resolve the current agent-ready catalog; manual requires allowedTools.'
            },
            allowedTools: {
              type: 'array',
              items: {
                type: 'string'
              },
              description:
                'Required only when toolSelectionMode is manual. AI mode resolves tools server-side.'
            }
          }
        },
        BulkIdsRequest: {
          type: 'object',
          required: ['ids'],
          properties: {
            ids: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        },
        AgentRun: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            objective: { type: 'string' },
            ownerWallet: { type: 'string' },
            budgetCapUsdt: { type: 'number' },
            maxPaidActions: { type: 'number' },
            status: { type: 'string' },
            fundingStatus: { type: 'string' },
            vaultPaymentId: { type: 'string' },
            vaultAddress: { type: 'string' },
            fundedAmountUsdt: { type: 'string' },
            spentAmountUsdt: { type: 'string' },
            reservedAmountUsdt: { type: 'string' },
            refundedAmountUsdt: { type: 'string' },
            availableAmountUsdt: { type: 'string' },
            fundingTxHash: { type: 'string' },
            refundTxHash: { type: 'string' },
            ledgerEvents: {
              type: 'array',
              items: { $ref: '#/components/schemas/AgentLedgerEvent' }
            },
            summary: { type: 'string' },
            deliverables: {
              type: 'object',
              properties: {
                plannerMode: {
                  type: 'string',
                  enum: ['openai', 'deterministic']
                },
                plannerModel: { type: 'string' },
                plannerResponseId: { type: 'string' },
                planningPrompt: { type: 'string' },
                toolSelectionRationale: { type: 'string' },
                skippedTools: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      slug: { type: 'string' },
                      productName: { type: 'string' },
                      reason: { type: 'string' }
                    }
                  }
                },
                expectedDeliverables: {
                  type: 'array',
                  items: { type: 'string' }
                },
                budgetStrategy: { type: 'string' },
                synthesisInstructions: { type: 'string' },
                synthesisModel: { type: 'string' },
                synthesisResponseId: { type: 'string' },
                launchBrief: { type: 'string' },
                developerCopy: { type: 'string' },
                marketSignal: { type: 'string' },
                videoResultUrl: { type: 'string' },
                proofExplanation: { type: 'string' }
              }
            },
            actions: {
              type: 'array',
              items: { $ref: '#/components/schemas/AgentAction' }
            },
            proof: { $ref: '#/components/schemas/AgentProof' }
          }
        },
        AgentLedgerEvent: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: { type: 'string' },
            label: { type: 'string' },
            amountUsdt: { type: 'string' },
            txHash: { type: 'string' },
            explorerUrl: { type: 'string' },
            actionId: { type: 'string' },
            createdAt: { type: 'string' }
          }
        },
        AgentAction: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            productSlug: { type: 'string' },
            status: { type: 'string' },
            amountUsdt: { type: 'string' },
            orderId: { type: 'string' },
            requestId: { type: 'string' },
            receipt: { $ref: '#/components/schemas/Receipt' }
          }
        },
        AgentProof: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            runId: { type: 'string' },
            ownerWallet: { type: 'string' },
            proofHash: { type: 'string' },
            proofUri: { type: 'string' },
            network: { type: 'string', enum: [x402Network] },
            txHash: { type: ['string', 'null'] },
            explorerUrl: { type: ['string', 'null'] },
            receiptIds: { type: 'array', items: { type: 'string' } },
            totalSpendUsdt: { type: 'string' }
          }
        },
        AgentProofResponse: {
          type: 'object',
          properties: {
            proof: { $ref: '#/components/schemas/AgentProof' },
            run: { type: 'object', additionalProperties: true }
          }
        },
        ReadinessCheck: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            value: { type: 'string' },
            state: { type: 'string', enum: ['ready', 'attention'] },
            detail: { type: 'string' }
          }
        }
      }
    }
  })
}

function pathStringParameter(name: string) {
  return {
    name,
    in: 'path',
    required: true,
    schema: { type: 'string' }
  }
}

function paidCallOperation(method: 'GET' | 'POST') {
  return {
    tags: ['x402'],
    summary: `${method} a paid API product`,
    security: [{ x402Payment: [] }],
    parameters: [
      {
        name: 'slug',
        in: 'path',
        required: true,
        schema: {
          type: 'string'
        }
      }
    ],
    requestBody:
      method === 'POST'
        ? {
            required: true,
            content: {
              'application/json': {
                schema: { type: 'object', additionalProperties: true }
              }
            }
          }
        : undefined,
    responses: {
      '200': {
        description: 'Paid provider response and receipt metadata',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                order: { $ref: '#/components/schemas/Order' },
                receipt: { $ref: '#/components/schemas/Receipt' },
                data: { type: 'object', additionalProperties: true }
              }
            }
          }
        }
      },
      '402': {
        description: 'x402 PYUSD payment required'
      },
      '502': {
        description: 'Provider request failed'
      }
    }
  }
}
