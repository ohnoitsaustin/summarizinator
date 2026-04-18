import * as cdk from 'aws-cdk-lib'
import { SummarizinatorStack } from '../lib/summarizinator-stack'

const app = new cdk.App()
new SummarizinatorStack(app, 'Summarizinator', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  },
})
