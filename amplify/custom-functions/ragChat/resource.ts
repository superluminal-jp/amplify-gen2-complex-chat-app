import { CfnOutput, Stack, StackProps, Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import outputs from "../../../amplify_outputs.json";

export class RagChatLambdaStack extends Stack {
    constructor(
        scope: Construct,
        id: string,
        props: StackProps & {
            functionNamePrefix?: string; // Prefix for the Lambda function name
            includeSandboxSuffix?: boolean; // Whether to append "sandbox" suffix
            codePath?: string; // Path to Lambda function code
            description?: string; // Lambda function description
            environmentVariables?: { [key: string]: string }; // Environment variables
            s3BucketName?: string; // S3 bucket to grant access to
            layerArnList?: string[]; // List of Lambda Layer ARNs to attach
            timeoutInSeconds?: number; // Function timeout in seconds
            memorySizeInMB?: number; // Function memory allocation in MB
        }
    ) {
        super(scope, id, props);

        // Extract and set default values for properties
        const {
            functionNamePrefix = "ragChat",
            includeSandboxSuffix = false,
            codePath = "./amplify/custom-functions/ragChat",
            description = "Custom Lambda function created using CDK",
            environmentVariables = {},
            s3BucketName,
            layerArnList = [],
            timeoutInSeconds = 300,
            memorySizeInMB = 128,
        } = props;

        // Check if this is a sandbox environment
        const isSandbox =
            includeSandboxSuffix && this.stackName.includes("sandbox");

        // Generate Lambda function name with prefix and optional sandbox suffix
        // Ensure the total length doesn't exceed AWS Lambda's 64-character limit
        const prefix = `${functionNamePrefix}-`;
        const suffix = isSandbox ? "-sandbox" : "";
        const ALLOWED_LENGTH = 64;
        const maxStackNameLength =
            ALLOWED_LENGTH - prefix.length - suffix.length;
        const shortStackName = this.stackName.substring(0, maxStackNameLength);
        const functionName = `${prefix}${shortStackName}${suffix}`;

        // Create the Lambda function with specified configuration
        const ragChatFunction = new lambda.Function(this, "ragChatFunction", {
            runtime: lambda.Runtime.PYTHON_3_12,
            handler: "index.handler",
            code: lambda.Code.fromAsset(codePath),
            functionName: functionName,
            description: description,
            timeout: Duration.seconds(timeoutInSeconds),
            memorySize: memorySizeInMB,
            environment: environmentVariables,
            layers: layerArnList.map((arn, index) =>
                lambda.LayerVersion.fromLayerVersionArn(
                    this,
                    "faissLangchainLayer",
                    "arn:aws:lambda:ap-northeast-1:471112852670:layer:faissLayer:13"
                )
            ),
        });
        // // Define the Lambda function
        // const ragChatFunction = new lambda.Function(this, "RagChatFunction", {
        //     runtime: lambda.Runtime.PYTHON_3_12,
        //     handler: "index.handler",
        //     code: lambda.Code.fromAsset("./amplify/custom-functions/ragChat"),
        //     functionName: "ragChatFunction",
        //     description: "This is my custom Lambda function created using CDK",
        //     timeout: Duration.seconds(300),
        //     memorySize: 128,
        //     environment: {
        //         TEST: "test",
        //     },
        //     layers: [
        //         lambda.LayerVersion.fromLayerVersionArn(
        //             this,
        //             "faissLangchainLayer",
        //             "arn:aws:lambda:ap-northeast-1:471112852670:layer:faissLayer:13"
        //         ),
        //     ],
        // });

        // Bucket name from amplify_outputs.json
        // const s3_bucket = outputs.storage.bucket_name;
        const s3_bucket = s3BucketName;

        // Allow S3 access
        ragChatFunction.addToRolePolicy(
            new iam.PolicyStatement({
                actions: [
                    "s3:ListBucket",
                    "s3:GetObject",
                    "s3:PutObject",
                    "s3:DeleteObject",
                ],
                resources: [
                    `arn:aws:s3:::${s3_bucket}`,
                    `arn:aws:s3:::${s3_bucket}/*`,
                ],
            })
        );

        // --- Add permissions to use Bedrock ---
        ragChatFunction.addToRolePolicy(
            new iam.PolicyStatement({
                actions: [
                    // Typically needed for calling a model
                    "bedrock:InvokeModel",
                    // If you are using streaming responses
                    "bedrock:InvokeModelWithResponseStream",
                    // If you need to discover or list available models
                    "bedrock:ListFoundationModels",
                    "bedrock:ListCustomModels",
                    // Add others as needed (e.g., "bedrock:ListModelCustomizationJobs", etc.)
                ],
                // You can set Resource to "*" since model ARNs can vary
                resources: ["*"],
            })
        );

        // Export the Lambda function ARN for cross-stack references
        // Uses a unique export name combining stack name and function prefix
        new CfnOutput(this, "RagChatFunctionArnOutput", {
            value: ragChatFunction.functionArn,
            exportName: `${this.stackName}-${functionNamePrefix}FunctionArn`,
        });
        // // Output the Lambda function ARN
        // new CfnOutput(this, "RagChatFunctionArn", {
        //     value: ragChatFunction.functionArn,
        //     exportName: "ragChatFunctionArn",
        // });
    }
}
