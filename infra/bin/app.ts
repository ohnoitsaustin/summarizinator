import * as cdk from 'aws-cdk-lib'
import { SummarizinatorStack } from '../lib/summarizinator-stack'

const app = new cdk.App()

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'us-east-1',
}

new SummarizinatorStack(app, 'Summarizinator-dev', {
  env,
  config: {
    stackEnv: 'dev',
    domainName: 'dev.summarizinator.com',
    certArn: process.env.CERT_ARN ?? '',
  },
})

new SummarizinatorStack(app, 'Summarizinator-prod', {
  env,
  config: {
    stackEnv: 'prod',
    domainName: 'summarizinator.com',
    certArn: process.env.CERT_ARN ?? '',
  },
})
