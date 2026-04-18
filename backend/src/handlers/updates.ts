import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'

// TODO Phase 3: implement generate (fetch GitHub → filter → Bedrock → store)
// TODO Phase 3: implement regenerate (load rawEvents → filter → Bedrock → store)
// TODO Phase 3: implement list updates for project

export const handler = async (_event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  return {
    statusCode: 501,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Not implemented — Phase 3' }),
  }
}
