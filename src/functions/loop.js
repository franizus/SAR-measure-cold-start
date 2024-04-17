const { v4: uuid } = require('uuid');
const { Logger } = require('@aws-lambda-powertools/logger');
const { LambdaClient, GetFunctionConfigurationCommand, UpdateFunctionConfigurationCommand, waitUntilFunctionUpdatedV2 } = require("@aws-sdk/client-lambda");
const client = new LambdaClient();
const logger = new Logger();

module.exports.handler = async (input, context) => {  
	const functionName = input.functionName;
	const envVars = await getEnvVars(functionName);
	const payload = input.payload || "{}";
	const count = input.count || 100; // default to 100 iterations
	input.startTime = input.startTime || Date.now();

	let done = 0;
	for (let i = 0; i < count; i++) {
		await updateEnvVar(functionName, envVars);
		await invoke(functionName, payload);
		done++;

		if (context.getRemainingTimeInMillis() < 10000) {
			return { ...input, count: count - done };
		}
	}

	return { ...input, count: count - done };
};

const getEnvVars = async (functionName) => {
	logger.debug("getting current env variables", { functionName });
	const input = {
		FunctionName: functionName
	};
	const command = new GetFunctionConfigurationCommand(input);
	const resp = await client.send(command);

	return resp.Environment || { Variables: {} };
};

const updateEnvVar = async (functionName, envVars) => {
	logger.debug("touching environment variable", { functionName });
	envVars.Variables["uuid"] = uuid();

	const input = {
		FunctionName: functionName,
		Environment: envVars
	};
	const command = new UpdateFunctionConfigurationCommand(input);
	await client.send(command);
	
	await waitUntilFunctionUpdatedV2({client}, {FunctionName: functionName});
};

const invoke = async (functionName, payload) => {
	logger.debug("invoking", { functionName });
	const input = {
		FunctionName: functionName,
		InvocationType: "RequestResponse",
		Payload: payload
	};
	const command = new InvokeCommand(input);
	await client.send(command);
};
