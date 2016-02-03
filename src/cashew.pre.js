/**
 *
 * Cashew is a JAVA parser written in JavaScript.
 *
 * Cashew is written by Lucas Farias and Rafael Monteiro and released under an MIT
 * license. It was written using (Jison)[https://github.com/zaach/jison] by Zaach.
 *
 * Git repository for Cashew are available at
 *
 *     https://github.com/codecombat/cashew.git
 *
 * Please use the [github bug tracker][ghbt] to report issues.
 *
 * [ghbt]: https://github.com/codecombat/cashew/issues
 *
 **/
(function(root, mod) {
	if (typeof exports == "object" && typeof module == "object") return mod(exports);
	if (typeof define == "function" && define.amd) return define(["export"], mod);
	mod(root.cashew || (root.cashew = {}));
})(this, function(exports){

var methodsDictionary;
var mainMethodCall;

exports.Cashew = function(javaCode){

	___JavaRuntime.sourceCode = javaCode;
	methodsDictionary = [];
	constructorBodyNodes = [];
	mainMethodCall = undefined;
	
	//parser helpers
	cocoJava.yy._ = _;

	function getRuntimeFunctions(range){
		var functions = new node("MemberExpression");
		functions.range = range;
		var runtime = createIdentifierNode("___JavaRuntime", range);

		var runtimeMethod =  createIdentifierNode("functions", range);

		functions.object = runtime;
		functions.property = runtimeMethod;
		functions.computed = false;
		return functions;
	}

	function getRuntimeOps(range){
		var functions = new node("MemberExpression");
		functions.range = range;
		var runtime = createIdentifierNode("___JavaRuntime", range);

		var runtimeMethod =  createIdentifierNode("ops", range);

		functions.object = runtime;
		functions.property = runtimeMethod;
		functions.computed = false;
		return functions;
	}

	getVariableType = function(varName){
		var varType = "unknown";
		_.each(___JavaRuntime.variablesDictionary, function(variableEntry){
			if(variableEntry.name == varName){
				varType = variableEntry.type;
			}
		});
		return varType;
	}

	getArgumentForName = function(name, range){
		return createLiteralNode(name, "\""+name + "\"", range);
	}

	getArgumentForRange = function(range){
		var rangeNode = new node("ArrayExpression");
		rangeNode.range = [0,0];
		rangeNode.elements = [];
		rangeNode.elements.push(getArgumentForNumber(range[0], [0,0]));
		rangeNode.elements.push(getArgumentForNumber(range[1], [0,0]));
		return rangeNode;
	}

	getArgumentForVariable = function(name, range){
		return createIdentifierNode(name, range);
	}

	getNullArgument = function(){
		return createLiteralNode(null, "null", [0,0]);
	}

	getArgumentForNumber = function(number, range){
		return createLiteralNode(number, number, range);

	}

	/** AST Variable declaration and validation **/

	var varEntryId = 0;
	variableEntry = function(varName, varAccess, varType, varScope, varClass, varMethod, varASTNodeID){
		this.id = varEntryId;
    	this.name = varName;
    	this.access = varAccess;
    	this.type = varType;
    	this.scope = varScope;
    	this.clazz = varClass;
    	this.method = varMethod;
    	this.ASTNodeID = varASTNodeID;
		varEntryId += 1;
	}

	cocoJava.yy.createMethodSignatureObject = function createMethodSignatureObject(methodIdentifier, methodSignature, params, range){
		var methodSignatureObject = {
			'methodName' : methodIdentifier,
			'methodSignature' : methodSignature,
			'range' : range,
			'returnType' : null,
			'modifiers' : null,
			'clazz' : "__TemporaryClassName",
			'params' : params,
		}
		return methodSignatureObject;
	}

	// auxiliary functions

	//
	//This method is going to recursively look for all the references using a variable from this block and bellow it
	//TODO: make this more clear
	findUpdateChildren = function(ast, variable) {
	  for (var k in ast) {
	    if (typeof ast[k] == "object" && ast[k] !== null) {
	     	var node = ast[k];
	     	if(node.type !== undefined && node.type === "VariableDeclarator"){
				if(node.id.name == variable.name){
					node.javaType = variable.type;
					node.id.name = "__" + variable.id;
				}
			}
			if(node.type === "LogicalExpression" || node.type === "BinaryExpression"){
				if(node.left.name == variable.name){
					node.javaType = variable.type;
					node.left.name = "__" + variable.id;
				}
				if(node.right.name == variable.name){
					node.javaType = variable.type;
					node.right.name = "__" + variable.id;
				}
			}
			if( node.type === "SwitchStatement"){
				if(node.discriminant.type === "Identifier" && node.discriminant.name == variable.name){
					node.discriminant.javaType = variable.type;
					node.discriminant.name = "__" + variable.id;
				}
			}
			if(node.type === "UnaryExpression" || node.type === "ReturnStatement"){
				if(node.argument.type === "Identifier" && node.argument.name == variable.name){
					node.argument.javaType = variable.type;
					node.argument.name = "__" + variable.id;
				}
			}
			if(node.type === "CallExpression"){
				if(node.name && node.name == variable.name){
					node.javaType = variable.type;
					node.name = "__" + variable.id;	
				}
				_.each(node.arguments, function(argNode){
					if(argNode.type == "Identifier" && argNode.name == variable.name){
						node.javaType = variable.type;
						argNode.name = "__" + variable.id;
					}
				});
				if(node.callee.property && node.callee.property.name == "validateSet" && node.callee.object.object.name == "___JavaRuntime"){
					if(node.arguments[1].type == "Identifier" && node.arguments[1].name == "__" + variable.id){
						node.arguments[1].type = "Literal";

						node.arguments[1].name = undefined;

						node.arguments[1].value = "__" + variable.id;
						node.arguments[1].javaType = variable.type;
					}
				}
			}
			if(node.type === "Identifier"){
				if(node.name == variable.name){
					node.name = "__" + variable.id;
					node.javaType = variable.type;
				}
			}
			if(node.type === "ReturnStatement"){
				if(node.argument.name && node.argument.name == variable.name){
					node.argument.name = "__" + variable.id;
					node.javaType = variable.type;
				}
			}
			if(node.type !== undefined && node.type == "AssignmentExpression"){
				if (node.left.name && node.left.name == variable.name){
					node.left.name = "__" + variable.id;
					node.left.javaType = variable.type;
				}
				_.each(node.right.arguments, function(argNode){
					if(argNode.type == "Identifier" && argNode.name == variable.name){
						argNode.name = "__" + variable.id;
						argNode.javaType = variable.type;
					}
				});
			}
			
			ast[k] = node;
			ast[k] = findUpdateChildren(ast[k], variable);
	    }
	  }
	  return ast;
	}

	//This method is going to recursively look for all the references using method calls from this block and bellow it
	findUpdateMethodCalls = function(ast, returnType) {
		for (var k in ast) {
			if (typeof ast[k] == "object" && ast[k] !== null) {
	     		var node = ast[k];

				ast[k] = node;
				ast[k] = findUpdateChildren(ast[k], variable);
			}
		}
		return ast;
	}
	
	/** AST generation methods and structures **/

	var ASTNodeID = 0;
	var ast = {
	    rootNode: {
	        type : "Program",
	        ASTNodeID: 0,
	        range: [],
	        body : []
	    },
	    currentNode: this.rootNode,
	    createRoot: function(node, range) {
	     this.rootNode.range = range;
	     if(node != null){
	     	this.rootNode.body = this.rootNode.body.concat(node);
	     	checkForMainMethod();
	     	if(mainMethodCall){
	     		this.rootNode.body.push(mainMethodCall);
	     	}
	     }

	  	env = {"type":"ExpressionStatement","expression":{"type":"CallExpression","callee":{"type":"MemberExpression","computed":false,"object":{"type":"Identifier","name":"___JavaRuntime"},"property":{"type":"Identifier","name":"loadEnv"}},"arguments":[]}};;
        //insert the script that load some variables to the environment
		this.rootNode.body.unshift(env);
		
	     return this.rootNode;
	    }

	  };
	cocoJava.yy.ast = ast;

	node = function(type){
		ASTNodeID += 1;
		this.type = type;
		this.ASTNodeID = ASTNodeID;
	}

	var checkForMainMethod = function checkForMainMethod(){
		_.each(methodsDictionary, function(methodsEntry){
			if(methodsEntry.methodName == "main"){
				var expressionNode = new node("ExpressionStatement");
			     expressionNode.range = methodsEntry.range;

			     var expressionNodeExpression = new node("CallExpression");
			     expressionNodeExpression.range = methodsEntry.range;

			     var myClassIndentifier = createIdentifierNode(methodsEntry.clazz, methodsEntry.range);
			     var mainIdentifierProperty = createIdentifierNode("main", methodsEntry.range);
			     expressionNodeExpression.callee = createMemberExpressionNode(myClassIndentifier, mainIdentifierProperty, methodsEntry.range);

			     expressionNodeExpression.arguments = [];

			     expressionNode.expression = expressionNodeExpression;
			     mainMethodCall = expressionNode;
			}
		});
	}

	var createLiteralNode = cocoJava.yy.createLiteralNode = function createLiteralNode(value, raw, range, javaType){
		if(javaType){
			var expression = new node("CallExpression");
			expression.range = range;
			expression.callee = createMemberExpressionNode(getRuntimeFunctions(range), createIdentifierNode("createNumber",range), range);
			expression.arguments = [];
			expression.arguments.push(getArgumentForNumber(value, range));
			expression.arguments.push(getArgumentForName(javaType,range));
			return expression;
		}else{
			var literalNode = new node("Literal");
			literalNode.range = range;
			literalNode.value = value;
			literalNode.raw = ""+raw;
			return literalNode;
		}
	}

	var createIdentifierNode = cocoJava.yy.createIdentifierNode = function createIdentifierNode(name, range){
		var identifierNode = new node("Identifier");
		identifierNode.range = range;
		identifierNode.name = name;
		return identifierNode;
	}

	var createArrayIdentifierNode = cocoJava.yy.createArrayIdentifierNode = function createArrayIdentifierNode(varName, varRange, index1Node, index1Range, index2Node, index2Range, range){
		var identifierNode = createMemberExpressionNode(createIdentifierNode(varName, varRange), index1Node, index1Range, true);
		if(index2Node){
			identifierNode = createMemberExpressionNode(identifierNode, index2Node, index2Range, true);
		}
		return identifierNode;
	}

	var createMemberExpressionNode = function createMemberExpressionNode(objectNode, propertyNode, range, computed){
		var memberExpressionNode = new node("MemberExpression");
		memberExpressionNode.computed = computed || false;
		memberExpressionNode.range = range;
		memberExpressionNode.object = objectNode;
		memberExpressionNode.property = propertyNode;
		return memberExpressionNode;
	}

	//FIXME disabling validations for now
	var createUpdateClassVariableReference = cocoJava.yy.createUpdateClassVariableReference = function createUpdateClassVariableReference(variableNodes, className, block){
		/*_.each(variableNodes, function(variableNode){
			_.each(variableNode.declarations, function(varNode){
				var newVar = new variableEntry(varNode.id.name, "", variableNode.javaType, 
					"class", className, "", variableNode.ASTNodeID);
				findUpdateChildren(block, newVar);
				___JavaRuntime.variablesDictionary.push(newVar);
			});
		});*/
	}

	cocoJava.yy.createUpdateMethodVariableReference = function createUpdateMethodVariableReference(variableNodes, methodProperties, block){
		/*_.each(variableNodes, function(variableNode){
			var newVar = new variableEntry(variableNode.declarations[0].id.name, "", variableNode.javaType, 
				"method", "", methodProperties.methodSignature, variableNode.ASTNodeID);
			findUpdateChildren(block, newVar);
			___JavaRuntime.variablesDictionary.push(newVar);
		});*/
	}

	createUpdateParamVariableReference = function createUpdateParamVariableReference(paramNodes, methodProperties, block){
		/*_.each(paramNodes, function(paramNode){
			var newVar = new variableEntry(paramNode.name, "", paramNode.javaType, 
				"method", "", methodProperties.methodSignature, paramNode.ASTNodeID);
			findUpdateChildren(block, newVar);
			findUpdateChildren(paramNodes, newVar);
			___JavaRuntime.variablesDictionary.push(newVar);
		});*/
	}

	cocoJava.yy.createUpdateBlockVariableReference = function createUpdateBlockVariableReference(variableNodes, block){
		/*_.each(variableNodes, function(variableNode){
			_.each(variableNode.declarations, function(varNode){
				var newVar = new variableEntry(varNode.id.name, "", variableNode.javaType, 
					"", "", "", variableNode.ASTNodeID);
				findUpdateChildren(block, newVar);
				___JavaRuntime.variablesDictionary.push(newVar);
			});
		});*/
	}

	var createMethodDeclarationNode = cocoJava.yy.createMethodDeclarationNode = function createMethodDeclarationNode(methodSignatureObject, headerRange, methodBodyNodes, methodBodyRange, range){
		if(methodSignatureObject.returnType == 'void'){
			_.each(methodBodyNodes , function(bodyNode){
				if(bodyNode.type === "ReturnStatement"){
					raise("Cannot return a value from method whose return type is void", range);
				}
			});
		}
		var isStatic = false;
		_.each(methodSignatureObject.modifiers, function(modifier){
			if (modifier == "static"){
				isStatic = true;
			}
		});

		var isPrivate = true;
		_.each(methodSignatureObject.modifiers, function(modifier){
			if (modifier == "public"){
				isPrivate = false;
			}
		});

		methodsDictionary.push(methodSignatureObject);
		var functionDeclarationNode = new node("ExpressionStatement");
		functionDeclarationNode.range = range;

		var functionDeclarationNodeAssignment = new node("AssignmentExpression");
		functionDeclarationNodeAssignment.range = range;
		functionDeclarationNodeAssignment.operator = '=';

		var functionDeclarationNodeAssignmentLeftObject;
		if(isStatic){
			functionDeclarationNodeAssignmentLeftObject = createIdentifierNode("__TemporaryClassName", [0,0]);
		}else{
			functionDeclarationNodeAssignmentLeftObject = createMemberExpressionNode(createIdentifierNode("__TemporaryClassName", [0,0]), createIdentifierNode("prototype", headerRange), headerRange);
		}

		var functionDeclarationNodeAssignmentLeft;
		if(isPrivate){
			functionDeclarationNodeAssignmentLeft =  createIdentifierNode(methodSignatureObject.methodName, headerRange);
		}else{
			functionDeclarationNodeAssignmentLeft = createMemberExpressionNode(functionDeclarationNodeAssignmentLeftObject, createIdentifierNode(methodSignatureObject.methodName, headerRange), range);
		}
			
		functionDeclarationNodeAssignment.left = functionDeclarationNodeAssignmentLeft;

		var functionDeclarationNodeAssignmentRight = new node("FunctionExpression");
		functionDeclarationNodeAssignmentRight.range = methodBodyRange;
		functionDeclarationNodeAssignmentRight.id = null;
		if(methodSignatureObject.params == null){
			functionDeclarationNodeAssignmentRight.params = [];
		}else{
			var paramNodes = [];
			_.each(methodSignatureObject.params, function(param){
				var newParam = createIdentifierNode(param.paramName, param.range);
				newParam.javaType = param.type;
				paramNodes.push(newParam);
			});
			createUpdateParamVariableReference(paramNodes, methodSignatureObject, methodBodyNodes);
			functionDeclarationNodeAssignmentRight.params = paramNodes;
		}
		functionDeclarationNodeAssignmentRight.defaults = [];
		functionDeclarationNodeAssignmentRightBody = new node("BlockStatement");
		functionDeclarationNodeAssignmentRightBody.range = methodBodyRange;
		functionDeclarationNodeAssignmentRightBody.body = [];
		functionDeclarationNodeAssignmentRightBody.body = functionDeclarationNodeAssignmentRightBody.body.concat(methodBodyNodes);
		functionDeclarationNodeAssignmentRight.body = functionDeclarationNodeAssignmentRightBody;
		functionDeclarationNodeAssignmentRight.generator = false;
		functionDeclarationNodeAssignmentRight.expression = false;

		var functionDeclarationNodeAssignmentMethod = new node("AssignmentExpression");
		functionDeclarationNodeAssignmentMethod.range = range;
		functionDeclarationNodeAssignmentMethod.operator = '='; 
		functionDeclarationNodeAssignmentMethod.left = createIdentifierNode(methodSignatureObject.methodName, headerRange);
		functionDeclarationNodeAssignmentMethod.right = functionDeclarationNodeAssignmentRight

		functionDeclarationNodeAssignment.right = functionDeclarationNodeAssignmentMethod;

		if (isStatic && !isPrivate){
			var functionDeclarationNodeAssignmentStatic = new node("AssignmentExpression");
			functionDeclarationNodeAssignmentStatic.range = range;
			functionDeclarationNodeAssignmentStatic.operator = '=';
			functionDeclarationNodeAssignmentStatic.right = functionDeclarationNodeAssignment.right;
			var leftObject = createMemberExpressionNode(createIdentifierNode("__TemporaryClassName", [0,0]), createIdentifierNode("prototype", headerRange), headerRange);
			var left = createMemberExpressionNode(leftObject, createIdentifierNode(methodSignatureObject.methodName, headerRange), range);
			functionDeclarationNodeAssignmentStatic.left = left;
			functionDeclarationNodeAssignment.right = functionDeclarationNodeAssignmentStatic;
		}

		functionDeclarationNode.expression = functionDeclarationNodeAssignment;
		functionDeclarationNode.details = methodSignatureObject;
		return functionDeclarationNode;
	}

	cocoJava.yy.createSimpleClassDeclarationNode = function createClassDeclarationNode(className, classNameRange, classBody, classBodyRange, range){
		return createClassExtendedDeclarationNode(className, classNameRange, classBody, classBodyRange, null, null, range);
	}
	
	var createClassExtendedDeclarationNode = cocoJava.yy.createClassExtendedDeclarationNode = function createClassExtendedDeclarationNode(className, classNameRange, classBody, classBodyRange, extensionName, extensionRange, range){ 
		var classNode = new node("ExpressionStatement");
		classNode.range = range;

		var classNameId = createIdentifierNode(className, classNameRange);

		var classNodeExpression = new node("AssignmentExpression");
		classNodeExpression.range = range;
		classNodeExpression.operator = '=';
		classNodeExpression.left = classNameId;

		var classNodeExpressionRightCallee = new node("FunctionExpression");
		classNodeExpressionRightCallee.range = range;
		classNodeExpressionRightCallee.id = null;
		classNodeExpressionRightCallee.params = [];
		classNodeExpressionRightCallee.defaults = [];

		var classNodeExpressionRightCalleeBody = new node("BlockStatement");
		classNodeExpressionRightCalleeBody.range = classBodyRange;
		classNodeExpressionRightCalleeBody.body = [];

		//Extract variables from the class
		var variableNodes = [];
		_.each(classBody, function(fieldNode){
			if(fieldNode.type == "ExpressionStatement" && fieldNode.expression.type == "SequenceExpression"){
				if(!fieldNode.expression.isPrivate){
					var constructorExpressions = [];
					var staticExpressions = [];
					_.each(fieldNode.expression.expressions, function(varNode){
						var lastMember = varNode.right.right;
						varNode.right.right = lastMember.left;
						constructorExpressions.push(varNode);
						lastMember.left.object.name = className;
						staticExpressions.push(lastMember);
					});
					//JSON clone
					variableNodes.push(JSON.parse(JSON.stringify(fieldNode)));
					fieldNode.expression.expressions = staticExpressions;
				}
				else if(fieldNode.expression.isPrivate && fieldNode.expression.isStatic){
					var constructorExpressions = [];
					var staticExpressions = [];
					_.each(fieldNode.expression.expressions, function(varNode){
						var lastMember = varNode.right;
						varNode.right = lastMember.left;
						constructorExpressions.push(varNode);
						lastMember.left.object.name = className;
						staticExpressions.push(lastMember);
					});
					//JSON clone
					variableNodes.push(JSON.parse(JSON.stringify(fieldNode)));
					fieldNode.expression.expressions = staticExpressions;
				}else{
					var constructorExpressions = [];
					_.each(fieldNode.expression.expressions, function(varNode){
						var lastMember = varNode;
						varNode = lastMember.left;
						constructorExpressions.push(varNode);
					});
					//JSON clone
					variableNodes.push(JSON.parse(JSON.stringify(fieldNode)));
					fieldNode.expression.expressions = [];
				}
					
			}
		});
		//Insert the constructor
		classNodeExpressionRightCalleeBody.body.push(createConstructorNode(className, constructorBodyNodes, classNameRange, variableNodes, extensionName));
		//reset bodyNodes to next class
		constructorBodyNodes = [];

		var typeNode = new node("ExpressionStatement");
		typeNode.range = range;
        var memberExpressionVar = createMemberExpressionNode(createMemberExpressionNode(createIdentifierNode(className, classNameRange), createIdentifierNode("prototype", classNameRange), classNameRange), createIdentifierNode("__type", [0,0]), range);
        var declarationNodeAssignment = new node("AssignmentExpression");
				declarationNodeAssignment.range = classNameRange;
				declarationNodeAssignment.operator = '=';
				declarationNodeAssignment.left = memberExpressionVar;
				declarationNodeAssignment.right = getArgumentForName(className, classNameRange);
		typeNode.expression = declarationNodeAssignment;

		//Clone the prototype to extend
		//MyClass.prototype = Object.create(_Object.prototype);
		var extensionClass;
		if(extensionName == null){
			extensionClass = createIdentifierNode("_Object", classNameRange);
		}else{
			extensionClass = createIdentifierNode(extensionName, extensionRange);
		}
		var extensionProto = createMemberExpressionNode(extensionClass, createIdentifierNode("prototype",classNameRange) ,classNameRange);
		var classProto = createMemberExpressionNode(createIdentifierNode(className, classNameRange), createIdentifierNode("prototype",classNameRange), classNameRange);

		var assignmentProto = new node("AssignmentExpression");
		assignmentProto.range = classNameRange;
		assignmentProto.operator = "=";
		assignmentProto.left = classProto;

		var objectCreate = new node("CallExpression");
		objectCreate.range = classNameRange;
		objectCreate.callee = createMemberExpressionNode(createIdentifierNode("Object", [0,0]),createIdentifierNode("create", [0,0]), classNameRange);
		objectCreate.arguments = [];
		objectCreate.arguments.push(extensionProto);

		assignmentProto.right = objectCreate;

		classNodeExpressionRightCalleeBody.body.push(createExpressionStatementNode(assignmentProto, classNameRange));

		//".class" = __type
		classNodeExpressionRightCalleeBody.body.push(typeNode);

		//Add Methods to the class
		classNodeExpressionRightCalleeBody.body = classNodeExpressionRightCalleeBody.body.concat(createMethodOverload(classBody));
		
		//Replaces __TemproaryClass in class body nodes and updates methods dictionary
		replaceTemporaryClassWithClassName(classNodeExpressionRightCalleeBody.body, className, extensionName);
		_.each(methodsDictionary, function(methodSignature){
			if(methodSignature.clazz == "__TemporaryClassName"){
				methodSignature.clazz = className;
			}
		});

		//Return the class
		classNodeExpressionRightCalleeBody.body.push(createReturnStatementNode(createIdentifierNode(className, classNameRange), classNameRange));

		classNodeExpressionRightCallee.body = classNodeExpressionRightCalleeBody;
		classNodeExpressionRightCallee.generator = false;
		classNodeExpressionRightCallee.expression = false;

		var extensionExpressionXp = new node("CallExpression");
		extensionExpressionXp.range = range;
		extensionExpressionXp.callee = createMemberExpressionNode(classNodeExpressionRightCallee, createIdentifierNode("call", range), range);
		extensionExpressionXp.arguments = [];
		var args = new node("ThisExpression");
		args.range = range;
		extensionExpressionXp.arguments.push(args);


		classNodeExpression.right = extensionExpressionXp;

		classNode.expression = classNodeExpression;


		return classNode;
	}

	var createMethodOverload = function createMethodOverload(classBodyNodes){
		var methodsWithOverload = [];
		var nodesWithoutOverload = [];
		var methodsWithOverloadDetails = [];
		var methodWithOverloadFunctionNode = [];
		for (var i = classBodyNodes.length - 1; i >= 0; i--) {
			var methodOverload = false;
			//determine if the node is a method
			if(classBodyNodes[i].details){
				var methodName = classBodyNodes[i].details.methodName;
				//if the current overload is not in the array yet, map it!
				if(methodsWithOverload.indexOf(methodName) == -1){
					for (var j = classBodyNodes.length - 1; j >= 0; j--) {
						//if its not the current Node and if it's not already in the overloaded methods
						if(i != j){
							//determine if the other node is a method
							if(classBodyNodes[j].details){
								//check if there's other methods with the same name
								if(methodName == classBodyNodes[j].details.methodName){
									methodOverload = true;
									methodsWithOverload.push(methodName);
									methodsWithOverloadDetails.push(classBodyNodes[j].details);
									//get function definitions for the nodes overloaded
									if(classBodyNodes[j].expression.right.type == "FunctionExpression"){
										methodWithOverloadFunctionNode.push(classBodyNodes[j].expression.right);
									}else if(classBodyNodes[j].expression.right.right.type == "FunctionExpression"){
										methodWithOverloadFunctionNode.push(classBodyNodes[j].expression.right.right);
									}else{
										methodWithOverloadFunctionNode.push(classBodyNodes[j].expression.right.right.right);
									}

								}
							}
						}
					}
					//if there's already a method with this name in the overload pile
					//the current should also be
					if(methodsWithOverload.indexOf(methodName) >= 0){
						//add the current to the overloaded pile
						methodsWithOverload.push(methodName);
						methodsWithOverloadDetails.push(classBodyNodes[i].details);
						//get function definitions for the nodes overloaded
						if(classBodyNodes[i].expression.right.type == "FunctionExpression"){
							methodWithOverloadFunctionNode.push(classBodyNodes[i].expression.right);
						}else if(classBodyNodes[i].expression.right.right.type == "FunctionExpression"){
							methodWithOverloadFunctionNode.push(classBodyNodes[i].expression.right.right);
						}else{
							methodWithOverloadFunctionNode.push(classBodyNodes[i].expression.right.right.right);
						}	
					}
					if(!methodOverload){
						nodesWithoutOverload.push(classBodyNodes[i]);
					}
				}
			}
		}
		for (var i = 0; i < methodsWithOverload.length; i++) {
			//check for duplicate sigatures in overloaded methods
			currentSignature = methodsWithOverloadDetails[i].methodSignature;
			for (var j = 0; j < methodsWithOverload.length; j++){
				//if the current signature matches any signature raise an exception
				if(i != j){
					if (currentSignature == methodsWithOverloadDetails[j].methodSignature){
						raise("Duplicated method signature " + currentSignature + "!", methodsWithOverloadDetails[j].range);
					}
				}
			}
		};
		for (var i = 0; i < methodsWithOverload.length; i++) {
			//keep the original method name in details
			methodsWithOverloadDetails[i].originalName = methodsWithOverload[i];
			//rename the signatures and build new methods
			methodsWithOverload[i] = methodsWithOverload[i] + i;
			var newExpressionStatement = new node("ExpressionStatement");
			newExpressionStatement.range = methodsWithOverloadDetails[i].range;
			newExpressionStatementAssign = new node("AssignmentExpression");
			newExpressionStatementAssign.range = methodsWithOverloadDetails[i].range;
			newExpressionStatementAssign.operator = "=";
			newExpressionStatementAssign.left = createIdentifierNode(methodsWithOverload[i]);
			newExpressionStatementAssign.right = methodWithOverloadFunctionNode[i];
			newExpressionStatement.expression = newExpressionStatementAssign;
			 methodWithOverloadFunctionNode[i] = newExpressionStatement;
		};
		//create the switcher
		var nodesWithOverload = [];
		var alreadyCreated = [];
		for (var i = 0; i < methodsWithOverload.length; i++) {
			var currentMethod = methodsWithOverloadDetails[i].originalName;
			if(alreadyCreated.indexOf(currentMethod) == -1){
				//only enter here once for each method name
				//creates a clone to preserve original
				methodsWithOverloadDetailsi = JSON.parse(JSON.stringify(methodsWithOverloadDetails[i]));
				alreadyCreated.push(currentMethod);
				range = methodsWithOverloadDetailsi.range; //get method range
				//creates a declaration with an empty body which will be created later
				methodsWithOverloadDetailsi.params = []; //remove all params because we will use arguments variable
				emptyBody = createMethodDeclarationNode(methodsWithOverloadDetailsi, range, [], range, range);
				nodesWithOverload.push(emptyBody);
			}
		};
		//All nodes with overload need a if/else system to determine which method it should call
		for (var i = 0; i < nodesWithOverload.length; i++) {
			var originalNameNode = nodesWithOverload[i].details.originalName;
			//going to look all methods and create the if/else for them;
			var ifCases = [];
			for (var j = 0; j < methodsWithOverload.length; j++) {
				//if the current nodeWithOverload is the same as the methodWithOverload
				//create a case for it
				if(originalNameNode == methodsWithOverloadDetails[j].originalName){
					//if there's no parameters arguments[0] == undefined
					if(methodsWithOverloadDetails[j].params.length == 0){
						ifCases.push(createIfForMatchingSignature([], methodsWithOverload[j]));
					}else{
						//needs to create a condition for each parameter
						var logicalTests = [];
						for (var k = 0; k < methodsWithOverloadDetails[j].params.length; k++) {
							var currentParameter = methodsWithOverloadDetails[j].params[k];
							logicalTest = createLogicalTestForIndexAndType(k,currentParameter.type);
							logicalTests.push(logicalTest);
						};
						ifCases.push(createIfForMatchingSignature(logicalTests, methodsWithOverload[j], methodsWithOverloadDetails[j].params.length));
					}
				}
			};
			//creates the new body for the overloaded body
			var overloadedBody = new node("BlockStatement");
			overloadedBody.range = nodesWithOverload[i].details.range;
			overloadedBody.body = ifCases;
			//check and push the overloaded body to the method body
			if(nodesWithOverload[i].expression.right.type == "FunctionExpression"){
				nodesWithOverload[i].expression.right.body = overloadedBody;
			}else if(nodesWithOverload[i].expression.right.right.type == "FunctionExpression"){
				nodesWithOverload[i].expression.right.right.body = overloadedBody;
			}else{
				nodesWithOverload[i].expression.right.right.right.body = overloadedBody;
			}
		};
		nodesWithoutOverload = nodesWithoutOverload.concat(nodesWithOverload);
		nodesWithoutOverload = nodesWithoutOverload.concat(methodWithOverloadFunctionNode);
		return nodesWithoutOverload;
	}

	var createIfForMatchingSignature = function createIfForMatchingSignature(conditions, functionNewName, paramsLength){
		var testExpression;
		var methodInvokeNodeExpressionArguments = [];
		if(conditions.length == 0){
			//the method has no parameters then arguments[0] == undefined
			testExpression = createExpression("==", "BinaryExpression", createArgumentArgumentsForIndex(0), createIdentifierNode("undefined",[0,0]), range);
		}
		else{
			//nest all conditions to match a signature starting from 1 to nest the first 2
			if(conditions.length == 1){
				testExpression = conditions[0];
			}else{
				for (var i = 1; i < conditions.length; i++) {
					testExpression = createExpression("&&", "LogicalExpression", conditions[i-1], conditions[i], [0,0]);
				};
			}
			//create a new Argument for each original argument
			for (var i = 0; i < paramsLength; i++) {
				methodInvokeNodeExpressionArguments.push(createArgumentArgumentsForIndex(i));
			};
		}

		var methodNode = createIdentifierNode(functionNewName, [0,0]);
		var methodInvokeNodeExpression = new node("CallExpression");
		methodInvokeNodeExpression.range = [0,0];
		methodInvokeNodeExpression.callee = methodNode;
		methodInvokeNodeExpression.arguments = methodInvokeNodeExpressionArguments;
		consequentBlock = createReturnStatementNode(methodInvokeNodeExpression, [0,0]);
		return createSimpleIfNode(testExpression, consequentBlock, [0,0], [0,0]);		
	}

	var createLogicalTestForIndexAndType = function createLogicalTestForIndexAndType(index, type){
		range = [0,0];
		var left = createExpression("==", "BinaryExpression", createDetermineTypeForIndex(index),  getArgumentForName("?", [0,0]), range);
		var right = createExpression("==", "BinaryExpression", createDetermineTypeForIndex(index),  getArgumentForName(type, [0,0]), range);
		var logicalExpression = createExpression("||", "LogicalExpression", left, right, range);
		return logicalExpression;
	}

	var createDetermineTypeForIndex = function createDetermineTypeForIndex(index){
		var determineTypeNode = new node("CallExpression");
	 	determineTypeNode.range = [0,0];
	 	determineTypeNode.arguments = [];
	 	determineTypeNode.arguments.push(createArgumentArgumentsForIndex(index));
		var callee = new node("MemberExpression");
		callee.range = [0,0];

		var functions = getRuntimeFunctions([0,0]);

		var determineTypeProperty = createIdentifierNode("determineType", [0,0]);

		callee.object = functions;
		callee.property = determineTypeProperty;
		callee.computed  = false;

	 	determineTypeNode.callee = callee;
	 	return determineTypeNode;
	}

	var createArgumentArgumentsForIndex = function createArgumentArgumentsForIndex(index){
		var argumentNode = new node("MemberExpression");
		argumentNode.computed = true;
		argumentNode.object = createIdentifierNode("arguments",[0,0]);
		argumentNode.property = getArgumentForNumber(index, [0,0]);
		return argumentNode;
	}

	cocoJava.yy.createOverrideDefaultConstructor = function createOverrideDefaultConstructor(modifiers, methodBodyNodes){
		constructorBodyNodes.push(methodBodyNodes);
	}
	var createDetermineTypeForExpression = function createDetermineTypeForExpression(expression){
		var determineTypeNode = new node("CallExpression");
	 	determineTypeNode.range = [0,0];
	 	determineTypeNode.arguments = [];
	 	determineTypeNode.arguments.push(expression);
		var callee = new node("MemberExpression");
		callee.range = [0,0];

		var functions = getRuntimeFunctions([0,0]);

		var determineTypeProperty = createIdentifierNode("determineType", [0,0]);

		callee.object = functions;
		callee.property = determineTypeProperty;
		callee.computed  = false;

	 	determineTypeNode.callee = callee;
	 	return determineTypeNode;
	}

	cocoJava.yy.createImportNodeForName  = function createImportNodeForName(name){
		//when importing other classes they shoud be here
		if(name == "java.util.ArrayList" || name == "java.util.List" || name == "java.util.*"){
			_ArrayList = {"type":"ExpressionStatement","expression":{"type":"CallExpression","callee":{"type":"MemberExpression","computed":false,"object":{"type":"Identifier","name":"___JavaRuntime"},"property":{"type":"Identifier","name":"loadLists"}},"arguments":[]}};
			return _ArrayList;
		}

	}

	cocoJava.yy.createFieldVariableNode = function createFieldVariableNode(modifiers, variableDeclarationNode, range){
		var isStatic = false;
		_.each(modifiers, function(modifier){
			if (modifier == "static"){
				isStatic = true;
				
			}
		});
		variableDeclarationNode.isStatic = isStatic;
		var isPrivate = undefined;
		_.each(modifiers, function(modifier){
			if (modifier == "public"){
				isPrivate = false;
			}if (modifier == "private"){
				isPrivate = true;
			}
		});
		variableDeclarationNode.isPrivate = isPrivate;

		if (isPrivate == undefined){
			//FIXME change this to a "NotImplementedException"
			raise("Field variables are only implemented as public or private", range);
		}else if(!isStatic && !isPrivate){
			//FIXME change this to a "NotImplementedException"
			raise("Instence variables are only implemented as private", range);
		}


		_.each(variableDeclarationNode.declarations, function(varNode){
			varNode.type = "AssignmentExpression";
			varNode.operator = "=";
			varNode.left = createMemberExpressionNode(createIdentifierNode("__TemporaryClassName", [0,0]), varNode.id, range);
			var prototypeClass;
			if(isStatic && !isPrivate){
				prototypeClass = new node("AssignmentExpression");
				prototypeClass.range = range;
				prototypeClass.operator = "=";
				prototypeClass.left = createMemberExpressionNode(createMemberExpressionNode(createIdentifierNode("__TemporaryClassName", [0,0]), createIdentifierNode("prototype", range), range), varNode.id, range);
				prototypeClassRight =  new node("AssignmentExpression");
				prototypeClassRight.range = range;
				prototypeClassRight.operator = "=";
				prototypeClassRight.left = createMemberExpressionNode(createIdentifierNode("this", [0,0]), varNode.id, range);
				if(varNode.init == null){
					prototypeClassRight.right = createIdentifierNode("undefined",[0,0]);
				}else{
					prototypeClassRight.right = varNode.init;
				}
				prototypeClass.right = prototypeClassRight;
			}else if (isStatic && isPrivate){
				prototypeClass = new node("AssignmentExpression");
				prototypeClass.range = range;
				prototypeClass.operator = "=";
				prototypeClass.left = createMemberExpressionNode(createIdentifierNode("this", [0,0]), varNode.id, range);
				if(varNode.init == null){
					prototypeClass.right = createIdentifierNode("undefined",[0,0]);
				}else{
					prototypeClass.right = varNode.init;
				}
			}else{
				varNode.left.object.name = "this";
				if(varNode.init == null){
					prototypeClass = createMemberExpressionNode(createIdentifierNode("this", [0,0]), varNode.id, range);
				}else{
					prototypeClass = varNode.init;
				}
			}
			
			varNode.right = prototypeClass;
			
			delete varNode.id;
			delete varNode.init;
		});
		variableDeclarationNode.type = "SequenceExpression";
		variableDeclarationNode.expressions = variableDeclarationNode.declarations;
		delete  variableDeclarationNode.declarations;

		return createExpressionStatementNode(variableDeclarationNode, range);
	}

	var replaceTemporaryClassWithClassName = function replaceTemporaryClassWithClassName(ast, className, extensionName){
		for (var k in ast) {
		    if (typeof ast[k] == "object" && ast[k] !== null) {
				var node = ast[k];
				if(node.type !== undefined && node.type == 'Identifier' && node.name == '__TemporaryClassName'){
					node.name = className;
				}
				if(node.type !== undefined && node.type == 'Identifier' && node.name == '__SuperClass'){
					node.name = extensionName;
				}
				if(node.type !== undefined && node.type == 'Identifier' && node.name == 'length'){
					node.name = "_length";
				}
				ast[k] = node;
				ast[k] = replaceTemporaryClassWithClassName(ast[k], className, extensionName);
			}
		}
		return ast;
	}

	var createConstructorNode = function createConstructorNode(className, methodBodyNodes, range, variableNodes, extensionName){
		var constructorNode = new node("FunctionExpression");
		constructorNode.range = range;
		constructorNode.id = createIdentifierNode(className, range);

		constructorNode.params = [];
		constructorNode.defaults = [];

		var constructorNodeBody = new node("BlockStatement");
		constructorNodeBody.range = range;
		constructorNodeBody.body = [];

		var constructorCallNode = new node("CallExpression");
		constructorCallNode.range = range;

		if(methodBodyNodes.length != 0){
			//if there's a constructor start building methods
			constructorNodeBody.body = constructorNodeBody.body.concat(createOverloadConstructorNode(className, extensionName, methodBodyNodes));
		}else{
			//call super(); if there's no explicit constructor
			var extensionClass;
			//extends
			if(extensionName == null){
				extensionClass = createIdentifierNode("_Object", range);
			}else{
				extensionClass = createIdentifierNode(extensionName, range);
			}
			var extensionExpression = new node("ExpressionStatement");
			extensionExpression.range = range;
			var extensionExpressionXp = new node("CallExpression");
			extensionExpressionXp.range = range;
			extensionExpressionXp.callee = createMemberExpressionNode(extensionClass, createIdentifierNode("call", range), range);
			extensionExpressionXp.arguments = [];
			var args = new node("ThisExpression");
			args.range = range;
			extensionExpressionXp.arguments.push(args);

			extensionExpression.expression = extensionExpressionXp;
			constructorNodeBody.body.push(extensionExpression);
		}

		if(variableNodes){
			constructorNodeBody.body = constructorNodeBody.body.concat(variableNodes);
		}

		constructorNode.body = constructorNodeBody;
		constructorNode.generator = false;
		constructorNode.expression = false;

		var expressionConstructor = new node("ExpressionStatement");
		expressionConstructor.range = range;

		var expressionConstructorExpression = new node("AssignmentExpression");
		expressionConstructorExpression.range = range;
		expressionConstructorExpression.operator = "=";
		expressionConstructorExpression.left = createIdentifierNode(className, range);
		expressionConstructorExpression.right = constructorNode;
		
		expressionConstructor.expression = expressionConstructorExpression;

		return expressionConstructor;
	}

	var createOverloadConstructorNode = function createOverloadConstructorNode(className, extensionName, bodyNodes){
		var ifNodes = [];
		for (var i = 0; i < bodyNodes.length; i++) {
			currentConstructor = bodyNodes[i];
			range = currentConstructor.details.range;
			//check if constructor has the same class name
			if(className != currentConstructor.details.methodName){
				raise("Constructor needs to have the same name as class", range);
			}
			//Check if there's a duplicate signature
			for (var j = 0; j < bodyNodes.length; j++) {
				otherConstructor = bodyNodes[j];
				if(i != j){
					if(currentConstructor.details.methodSignature == otherConstructor.details.methodSignature){
						raise("Duplicated constructor signature " + currentConstructor.details.methodSignature, range);
					}
				}
			};
			var noSuperCall = false;
			//Check if there's a super call in the constructor and if it's the first member
			for (var j = 0; j < bodyNodes[i].length; j++) {
				if(j != 0 && bodyNodes[i][j].expression.type == "CallExpression" && bodyNodes[i][j].expression.callee.object && (bodyNodes[i][j].expression.callee.object.name == "__SuperClass" || bodyNodes[i][j].expression.callee.object.name == "_Object")){
					raise("Call to super must be the first statement in constructor", range);
				}
				if(j == 0){
					if(bodyNodes[i][j].expression.type == "CallExpression"){
						if(bodyNodes[i][j].expression.callee.object){
							if(bodyNodes[i][j].expression.callee.object.name == "__SuperClass"){
								//if the first is a superCall replaces the __SuperClass for the actual name;
								if(extensionName == null){
									bodyNodes[i][j].expression.callee.object.name = "_Object";
								}else{
									bodyNodes[i][j].expression.callee.object.name = extensionName;
								}
							}else if (bodyNodes[i][j].expression.callee.object.name != "_Object"){
								//if it's not a super call for a super class and also not a super call from Object
								noSuperCall = true;
							}
						}else{
							noSuperCall = true;
						}
					}else{
						noSuperCall = true;
					}
				}
			};

			//If there's no super call insert the super();
			if (noSuperCall){
				var extensionClass;
				//extends
				if(extensionName == null){
					extensionClass = createIdentifierNode("_Object", range);
				}else{
					extensionClass = createIdentifierNode(extensionName, range);
				}
				var extensionExpression = new node("ExpressionStatement");
				extensionExpression.range = range;
				var extensionExpressionXp = new node("CallExpression");
				extensionExpressionXp.range = range;
				extensionExpressionXp.callee = createMemberExpressionNode(extensionClass, createIdentifierNode("call", range), range);
				extensionExpressionXp.arguments = [];
				var args = new node("ThisExpression");
				args.range = range;
				extensionExpressionXp.arguments.push(args);

				extensionExpression.expression = extensionExpressionXp;
				bodyNodes[i].unshift(extensionExpression);	
			}
			//Create a condition for each constructor
			//check params anc create conditions
			if(currentConstructor.details.params.length == 0){
				ifNodes.push(createIfForMatchingConstructor([], currentConstructor));
			}else{
				var conditions = [];
				for (var j = 0; j < currentConstructor.details.params.length; j++) {
					conditions.push(createLogicalTestForIndexAndType(j, currentConstructor.details.params[j].type));
					currentConstructor.unshift(createVariableReplacement(currentConstructor.details.params[j].paramName, j));
				};

				ifNodes.push(createIfForMatchingConstructor(conditions, currentConstructor, currentConstructor.details.params.length));
			}
		};
		return ifNodes;
	}

	var createVariableReplacement = function createVariableReplacement(paramName, index){
		var varReplacement = new node("VariableDeclarator");
		varReplacement.range = [0,0];
		varReplacement.id = createIdentifierNode(paramName, [0,0]);
		varReplacement.init = createArgumentArgumentsForIndex(index);
		var declarationReplacement = new node("VariableDeclaration");
		declarationReplacement.range = [0,0];
		declarationReplacement.declarations = [];
		declarationReplacement.declarations.push(varReplacement);
		declarationReplacement.kind = "var";
		return declarationReplacement;
	}

	var createIfForMatchingConstructor = function createIfForMatchingConstructor(conditions, consequentBlock, paramsLength){
		var testExpression;
		var methodInvokeNodeExpressionArguments = [];
		if(conditions.length == 0){
			//the method has no parameters then arguments[0] == undefined
			testExpression = createExpression("==", "BinaryExpression", createArgumentArgumentsForIndex(0), createIdentifierNode("undefined",[0,0]), [0,0]);
		}
		else{
			//nest all conditions to match a signature starting from 1 to nest the first 2
			if(conditions.length == 1){
				testExpression = conditions[0];
			}else{
				for (var i = 1; i < conditions.length; i++) {
					testExpression = createExpression("&&", "LogicalExpression", conditions[i-1], conditions[i], [0,0]);
				};
			}
			//create a new Argument for each original argument
			for (var i = 0; i < paramsLength; i++) {
				methodInvokeNodeExpressionArguments.push(createArgumentArgumentsForIndex(i));
			};
		}
		return createSimpleIfNode(testExpression, consequentBlock, [0,0], [0,0]);
	}

	cocoJava.yy.createInvokeNode = function createInvokeNode(nameOrObject, nameRange, invokeNode, invokeRange, range){
		var classObjectNode;
		if(typeof nameOrObject === "string"){
			classObjectNode = createIdentifierNode(nameOrObject, nameRange);
		}else{
			classObjectNode = nameOrObject;
		}
		var propertyNode, memberExpressionNode;
		if(typeof invokeNode === "string"){
			propertyNode = createIdentifierNode(invokeNode, invokeRange);
			memberExpressionNode = createMemberExpressionNode(classObjectNode, propertyNode, range);
			return memberExpressionNode;
		}else{
			propertyNode = invokeNode.callee;
			memberExpressionNode = createMemberExpressionNode(classObjectNode, propertyNode, range);
			invokeNode.callee = memberExpressionNode;
			return invokeNode;
		}
		
	}

	cocoJava.yy.createSimpleMethodInvokeNode = function createSimpleMethodInvokeNode(methodName, methodRange, argumentsNodes, range){
		var methodNode = createIdentifierNode(methodName, methodRange);
		var methodInvokeNodeExpression = new node("CallExpression");
		methodInvokeNodeExpression.range = range;
		methodInvokeNodeExpression.callee = methodNode;
		//TODO: Validate argument types
		methodInvokeNodeExpression.arguments = argumentsNodes;
		return methodInvokeNodeExpression;
	}

	cocoJava.yy.createConstructorCall = function createConstructorCall(methodName, methodRange, argumentsNodes, range){
		var constructorNode = new node("NewExpression");
		constructorNode.range = range;
		constructorNode.callee = createIdentifierNode(methodName, methodRange);
		constructorNode.arguments = argumentsNodes;
		return constructorNode;
	}

	cocoJava.yy.createSuperInvokeNode = function createSuperInvokeNode(methodNode, superRange, range){
		var oldCallee = methodNode.callee;
		var newCallee = createMemberExpressionNode(createIdentifierNode("__SuperClass", superRange), oldCallee, range);
		methodNode.callee = newCallee;
		return methodNode;
	}

	cocoJava.yy.createSuperConstructorNode = function createSuperConstructorNode(superRange, argumentsNodes, range){
		var superInvokeNodeExpression = new node("CallExpression");
		superInvokeNodeExpression.range = range;
		superInvokeNodeExpression.callee = createMemberExpressionNode(createIdentifierNode("__SuperClass", superRange), createIdentifierNode("call", superRange), range);
		superInvokeNodeExpression.arguments = [];
		var args = new node("ThisExpression");
		args.range = range;
		superInvokeNodeExpression.arguments.push(args);
		superInvokeNodeExpression.arguments = superInvokeNodeExpression.arguments.concat(argumentsNodes);
		return superInvokeNodeExpression;
	}

	var createVariableAttribution = cocoJava.yy.createVariableAttribution = function createVariableAttribution(varName, varRange, assignmentRange, expressionNode, index1, index2){
		var assignmentNode = new node("ExpressionStatement");
		assignmentNode.range = assignmentRange;

		var assignmentExpressionNode = new node("AssignmentExpression");
		assignmentExpressionNode.range = assignmentRange;
		assignmentExpressionNode.operator = '=';

		if(typeof varName === "string"){
			var varIdentifier = createIdentifierNode(varName, varRange); 
		}
		else{
			var varIdentifier = varName;
		}

		var assignmentNodeLeft;

		if(index1){
			assignmentNodeLeft = createMemberExpressionNode(varIdentifier, index1, varRange, true);
			if(index2){
				assignmentNodeLeft = createMemberExpressionNode(assignmentNodeLeft, index2, varRange, true);
			}
		}else{
			assignmentNodeLeft = varIdentifier;
		}
		assignmentExpressionNode.left = assignmentNodeLeft;

		if(expressionNode.type === "NewExpression"){
			assignmentExpressionNode.right = expressionNode;
		}else{
			//var setNode = createRuntimeCheckAssignment(varName, varRange, expressionNode, index1, index2, assignmentRange);
			//FIXME Removed Validations for now
			assignmentExpressionNode.right = expressionNode;
		}
		assignmentNode.expression = assignmentExpressionNode;
		return assignmentNode;
	}

	cocoJava.yy.createEmptyStatement = function createEmptyStatement(range){
		var emptyStatement = new node("EmptyStatement");
		emptyStatement.range = range;
		return emptyStatement;
	}

	cocoJava.yy.createMathOperation = function createMathOperation(op, left, right, range){
		var operation;
		switch (op){
			case '+':
				operation = "add";
				break;
			case '-':
				operation = "sub";
				break;
			case '*':
				operation = "mul";
				break;
			case '/':
				operation = "div";
				break;
			case '%':
				operation = "mod";
				break;
			default:
				raise('Invalid Operation', range);
				break;
		}

		var operationNode = new node("CallExpression");
		operationNode.range = range;
		operationNode.arguments = [];
		operationNode.arguments.push(left);
		operationNode.arguments.push(right);
		var callee = new node("MemberExpression");
		callee.range = range;

		var ops = getRuntimeOps(range);

		var opsProperty = createIdentifierNode(operation, range);

		callee.object = ops;
		callee.property = opsProperty;
		callee.computed  = false;

		operationNode.callee = callee;

		return operationNode;
	}

	var createExpression = cocoJava.yy.createExpression = function createExpression(op, type, left, right, range){
		if(op == "=="){
			var callExpression = new node("CallExpression");
			callExpression.range = range;
			callExpression.callee = createMemberExpressionNode(getRuntimeOps(range), createIdentifierNode("eq",range), range);
			callExpression.arguments = [];
			callExpression.arguments.push(left);
	 		callExpression.arguments.push(right);
			return callExpression;
		}
		else if(op == "!="){
			var callExpression = new node("CallExpression");
			callExpression.range = range;
			callExpression.callee = createMemberExpressionNode(getRuntimeOps(range), createIdentifierNode("neq",range), range);
			callExpression.arguments = [];
			callExpression.arguments.push(left);
	 		callExpression.arguments.push(right);
			return callExpression;
		}
		else{
			var logicalNode = new node(type);
			logicalNode.range = range;
			logicalNode.operator = op;
			logicalNode.left = left;
			logicalNode.right = right;
			return logicalNode;
		}
	}

	cocoJava.yy.createUnaryExpression = function createUnaryExpression(op, expression, range){
		if(op == "-"){
			var callExpression = new node("CallExpression");
			callExpression.range = range;
			callExpression.callee = createMemberExpressionNode(getRuntimeFunctions(range), createIdentifierNode("createNumber",range), range);
			callExpression.arguments = [];
			var unaryNode = new node("UnaryExpression");
			unaryNode.range = range;
			unaryNode.operator = op;
			unaryNode.prefix = "true";
			unaryNode.argument = expression;
			callExpression.arguments.push(unaryNode);
	 		callExpression.arguments.push(createDetermineTypeForExpression(expression));
			return callExpression;
		}else{
			var unaryNode = new node("UnaryExpression");
			unaryNode.range = range;
			unaryNode.operator = op;
			unaryNode.prefix = "true";
			unaryNode.argument = expression;
			return unaryNode;
		}		
	}

	var createTernaryNode = cocoJava.yy.createTernaryNode = function createTernaryNode(testExpression, consequentExpression, alternateExpression, expressionRange){
		var ternaryNode = new node("ConditionalExpression");
		ternaryNode.range = expressionRange;
		ternaryNode.test = testExpression;
		ternaryNode.consequent = consequentExpression;
		ternaryNode.alternate = alternateExpression;
		return ternaryNode;
	}

	cocoJava.yy.createVarDeclarationNode = function createVarDeclarationNode(type, declarators, declarationRange){
		var varDeclarationNode = new node("VariableDeclaration");
		varDeclarationNode.range = declarationRange;
		varDeclarationNode.kind = "var";
		varDeclarationNode.javaType = type;
		varDeclarationNode.declarations = [];

		varDeclarationNode.declarations = varDeclarationNode.declarations.concat(declarators);

		return varDeclarationNode;
	}

	cocoJava.yy.createVarDeclaratorNodeNoInit = function createVarDeclarationNodeNoInit(varName, declarationRange){
		var varDeclaratorNode = new node("VariableDeclarator");
		varDeclaratorNode.range = declarationRange;

		var idNode = createIdentifierNode(varName, declarationRange);
		varDeclaratorNode.id = idNode;
		varDeclaratorNode.init = null;

		return varDeclaratorNode;
	}

	cocoJava.yy.createVarDeclaratorNodeWithInit = function createVarDeclarationNodeWithInit(varName, varRange, assignment, assignmentRange, declarationRange){
		var varDeclaratorNode = new node("VariableDeclarator");
		varDeclaratorNode.range = declarationRange;

		var idNode = createIdentifierNode(varName, declarationRange);

		varDeclaratorNode.id = idNode;

		if(assignment.type === "NewExpression"){
			varDeclaratorNode.init = assignment;
		}else{
			//var initNode = createRuntimeCheckAssignment(varName, varRange, assignment, null, null, assignmentRange);
			//FIXME Removed Validations for now
			varDeclaratorNode.init = assignment;
		}
		return varDeclaratorNode;
	}

	var createRuntimeCheckAssignment = function createRuntimeCheckAssignment(varName, varRange, assignment, index1, index2, range){
		var initNode = new node("CallExpression");
		initNode.range = range;
		initNode.arguments = [];
		initNode.arguments.push(assignment);
		initNode.arguments.push(getArgumentForVariable(varName, varRange));
		initNode.arguments.push(getArgumentForVariable(varName, varRange));
		if(index1){
			initNode.arguments.push(index1);
		}else{
			initNode.arguments.push(getNullArgument());
		}
		if(index2){
			initNode.arguments.push(index2);
		}else{
			initNode.arguments.push(getNullArgument());
		}
		initNode.arguments.push(getArgumentForNumber(assignment.ASTNodeID, range));
		//FIXME changed validateSet to checkAssignment for now
		var callee = createMemberExpressionNode(getRuntimeFunctions(range), createIdentifierNode("checkAssignment", range), range, false);

		initNode.callee = callee;
		return initNode;
	}

	var createExpressionStatementNode = cocoJava.yy.createExpressionStatementNode =  function createExpressionStatementNode(expression, range){
		var expressionStatementNode = new node("ExpressionStatement");
		expressionStatementNode.range = range
		expressionStatementNode.expression = expression;
		return expressionStatementNode;
	}

	var createReturnStatementNode = cocoJava.yy.createReturnStatementNode =  function createReturnStatementNode(expression, range){
		var returnStatementNode = new node("ReturnStatement");
		returnStatementNode.range = range
		returnStatementNode.argument = expression;
		return returnStatementNode;
	}

	var createSimpleIfNode = cocoJava.yy.createSimpleIfNode = function createSimpleIfNode(testExpression, consequentBlock, consequentRange, ifRange){
		var simpleIf = new node("IfStatement");
		simpleIf.range = ifRange;
		simpleIf.test = testExpression;

		consequentNode = new node("BlockStatement");
		consequentNode.range = consequentRange;
		consequentNode.body = [];
		consequentNode.body = consequentNode.body.concat(consequentBlock);

		simpleIf.consequent = consequentNode;
		simpleIf.alternate = null;

		return simpleIf;
	}

	cocoJava.yy.createSimpleIfElseNode = function createSimpleIfElseNode(testExpression, consequentBlock, consequentRange, alternateBlock, alternateRange, ifRange){
		var ifElseNode = createSimpleIfNode(testExpression, consequentBlock, consequentRange, ifRange);

		alternateNode = new node("BlockStatement");
		alternateNode.range = alternateRange;
		alternateNode.body = [];
		alternateNode.body = alternateNode.body.concat(alternateBlock);

		ifElseNode.alternate = alternateNode;

		return ifElseNode;
	}

	var createSimpleListNode = cocoJava.yy.createSimpleListNode = function createSimpleListNode(varName, varRange, range){
		var simpleList = new node("VariableDeclarator");
		simpleList.range = range;

		var idNode = createIdentifierNode(varName, varRange);
		simpleList.id = idNode;

		var nodeList = new node("ExpressionStatement");
		simpleList.init = nodeList;

		return simpleList;
	}

	cocoJava.yy.createListWithInitNode = function createListWithInitNode(varName, varRange, initNode, range){
		var nullList = createSimpleListNode(varName, varRange, range);
		nullList.init = initNode;
		return nullList;
	}

	var createListInitialization = cocoJava.yy.createListInitialization = function createListInitialization(nodeType, range){
		var newExpressionNode = new node("NewExpression");
		newExpressionNode.range = range;
		var newExpressionNodecallee = createIdentifierNode("_ArrayList", range);
		newExpressionNode.callee = newExpressionNodecallee;
		newExpressionNode.arguments = [];
		newExpressionNode.arguments.push(getArgumentForName(nodeType, range));
		return newExpressionNode;
 	}

	var createSimpleArrayNode = cocoJava.yy.createSimpleArrayNode = function createSimpleArrayNode(varName, varRange, range){
		var simpleArray = new node("VariableDeclarator");
		simpleArray.range = range;

		var idNode = createIdentifierNode(varName, varRange);
		simpleArray.id = idNode;

		var nodeArray = new node("ArrayExpression")
		nodeArray.elements = [];
		simpleArray.init = nodeArray;

		return simpleArray;
	}

	cocoJava.yy.createArrayWithInitNode = function createArrayWithInitNode(varName, varRange, initNode, range){
		var nullArray = createSimpleArrayNode(varName, varRange, range);
		nullArray.init = initNode;
		return nullArray;
	}

	var createArrayWithNullInitialization = cocoJava.yy.createArrayWithNullInitialization = function createArrayWithNullInitialization(nodeExp, range){
		var nodeArray = new node("ArrayExpression")
			, size = nodeExp.value || 0;
		nodeArray.range = range;	
		nodeArray.elements = [];

		// TODO: Validar a expressão que declara o tamanho do array.
		_.times(parseInt(size),function(){
			var literal = getNullArgument();
			nodeArray.elements.push(literal);
		});
		return nodeArray;
	}

	cocoJava.yy.createTwoDimensionalArray = function createTwoDimensionalArray(nodesExp, range){
		var nodeArray = new node("ArrayExpression");
		nodeArray.range = range;
		nodeArray.elements = [];
		_.times(nodesExp[0].value, function(){
			if(nodesExp[1]){
				var literal = createArrayWithNullInitialization(nodesExp[1],range);
			}
			nodeArray.elements.push(literal);
		});
		return nodeArray;
	}

	var createArrayWithInitialization = cocoJava.yy.createArrayWithInitialization = function createArrayWithInitialization(values, range){
		var nodeArray = new node("ArrayExpression")
			, size = values.length;
		nodeArray.range = range;	
		nodeArray.elements = [];

		for (var i = 0; i < values.length; i++) {
			if(values[i].constructor == Array){
				nodeArray.elements.push(createArrayWithInitialization(values[i],range));
			}else{
				nodeArray.elements.push(values[i]);
			}
		};
		return nodeArray;
	}

	cocoJava.yy.validateDeclaratorsDimension = function validateDeclaratorsDimension(declaratorNodes, type){
		_.each(declaratorNodes, function(declaratorNode){
			if(declaratorNode.init.elements.length > 0 && declaratorNode.init.elements[0].type == "ArrayExpression"){
				raise("Invalid type for " + type, declaratorNode.range);
			}
		});
	}

	cocoJava.yy.createArrayFromInitialArray = function createArrayFromInitialArray(arrays, range){
		//determine if it's 1 or 2 dimension and validates if it's more than 2 dimension
		var dimensions = 1;
		for (var i = 0; i < arrays.length; i++) {
			if(arrays[i].constructor == Array){
				dimensions = 2;
			}
		}
		if(dimensions == 2){
			for (var i = 0; i < arrays.length; i++) {
				if(arrays[i].constructor != Array){
					raise("Incompatible types on array", range);
				}
				for(var j = 0; j < arrays[i].length; j++){
					if(arrays[i][j].constructor == Array){
						raise("More than 2-dimension arrays are not supported", range);
					}
				}
			}
		}
		return createArrayWithInitialization(arrays, range);
	}

	cocoJava.yy.createSwitchNode = function createSwitchNode(discriminant, cases, range){
		var switchNode = new node("SwitchStatement");
		switchNode.range = range;
		var correctedDiscriminant = new node("CallExpression");
		correctedDiscriminant.range = range;
		correctedDiscriminant.callee = createMemberExpressionNode(getRuntimeOps(range), createIdentifierNode("fixSwitch",range), range);
		correctedDiscriminant.arguments = [];
		correctedDiscriminant.arguments.push(discriminant);
 		correctedDiscriminant.arguments.push(getArgumentForRange(range));
		switchNode.discriminant = correctedDiscriminant;
		switchNode.cases = [];
		switchNode.cases = switchNode.cases.concat(cases);
		return switchNode;
	}

	cocoJava.yy.createDefaultSwitchNode = function createDefaultSwitchNode(range){
		return createCaseSwitchNode(null, range);
	}

	cocoJava.yy.addSwitchCaseStatements = function addSwitchCaseStatements(cases, block){
		cases[cases.length -1].consequent = block;
		return cases;
	}

	var createCaseSwitchNode = cocoJava.yy.createCaseSwitchNode = function createCaseSwitchNode(testExpression, range){
		var caseNode = new node("SwitchCase");
		caseNode.range = range;
		var correctedTest = null;
		if(testExpression){
			correctedTest = new node("CallExpression");
			correctedTest.range = range;
			correctedTest.callee = createMemberExpressionNode(getRuntimeOps(range), createIdentifierNode("fixSwitch",range), range);
			correctedTest.arguments = [];
			correctedTest.arguments.push(testExpression);
	 		correctedTest.arguments.push(getArgumentForRange(range));
		}
		caseNode.test = correctedTest;
		caseNode.consequent = [];
		return caseNode;
	}

	cocoJava.yy.createSimpleWhileNode = function createSimpleWhileNode(testExpression, whileBlock, blockRange, whileRange){
		var simpleWhile = new node("WhileStatement");
		simpleWhile.range = whileRange;
		simpleWhile.test = testExpression;

		blockNode = new node("BlockStatement");
		blockNode.range = blockRange;
		blockNode.body = [];
		blockNode.body = blockNode.body.concat(whileBlock);

		simpleWhile.body = blockNode;

		return simpleWhile;
	}

	cocoJava.yy.createDoWhileNode = function createDoWhileNode(testExpression, whileBlock, blockRange, whileRange){
		var doWhile = new node("DoWhileStatement");
		doWhile.range = whileRange;
		doWhile.test = testExpression;

		blockNode = new node("BlockStatement");
		blockNode.range = blockRange;
		blockNode.body = [];
		blockNode.body = blockNode.body.concat(whileBlock);

		doWhile.body = blockNode;

		return doWhile;
	}

	cocoJava.yy.createBreakStatement = function createBreakStatement(range){
		var breakNode = new node("BreakStatement");
		breakNode.range = range;

		return breakNode;
	}

	cocoJava.yy.createContinueStatement = function createContinueStatement(range){
		var continueNode = new node("ContinueStatement");
		continueNode.range = range;

		return continueNode;
	}

	cocoJava.yy.createForStatement = function createForStatement(forInit, testExpression, updateExpressions, updateRange, forBlock, blockRange, forRange){
		var forNode = new node("ForStatement");
		forNode.range = forRange;
		forNode.init = forInit;
		forNode.test = testExpression;

		if(updateExpressions.length == 1){
			forNode.update = updateExpressions[0].expression;
		}else if(updateExpressions.length > 1){
			var sequenceNode = new node("SequenceExpression");
			sequenceNode.range = updateRange;
			sequenceNode.expressions = [];
			_.each(updateExpressions, function(updateExp){
				sequenceNode.expressions.push(updateExp.expression);
			});
			forNode.update = sequenceNode;
		}

		blockNode = new node("BlockStatement");
		blockNode.range = blockRange;
		blockNode.body = [];
		blockNode.body = blockNode.body.concat(forBlock);

		forNode.body = blockNode;

		return forNode;
	}

	cocoJava.yy.createEnhancedForStatement = function createEnhancedForStatement(typeVar, varName, varRange, arraylist, arraylistRange, forBlock, blockRange, range){
		//list._arrayList.forEach(function(varName){blocks});
		var enhancedForExpression = new node("ExpressionStatement");
		enhancedForExpression.range = range;

		enhancedForExpressionExpression = new node("CallExpression");
		enhancedForExpressionExpression.range = range;

		enhancedConditional = createTernaryNode(createExpression("instanceof", "BinaryExpression", createIdentifierNode(arraylist,[0,0]),createIdentifierNode("_ArrayList",[0,0]),[0,0]), createMemberExpressionNode(createIdentifierNode(arraylist,arraylistRange),createIdentifierNode("_arraylist",range),range), createIdentifierNode(arraylist, [0,0]), [0,0]);

		enhancedForExpressionExpression.callee = createMemberExpressionNode(enhancedConditional, createIdentifierNode("forEach"),range);

		

		enhancedForExpressionArgument = new node("FunctionExpression");
		enhancedForExpressionArgument.range = range;
		enhancedForExpressionArgument.id = null;
		enhancedForExpressionArgument.params = [];
		enhancedForExpressionArgument.params.push(createIdentifierNode(varName, varRange));
		enhancedForExpressionArgument.defaults = [];

		enhancedForExpressionArgumentBlock = new node("BlockStatement");
		enhancedForExpressionArgumentBlock.range = blockRange;
		enhancedForExpressionArgumentBlock.body = forBlock;

		enhancedForExpressionArgument.body = enhancedForExpressionArgumentBlock;
		enhancedForExpressionArgument.generator = false;
		enhancedForExpressionArgument.expression = false;

		enhancedForExpressionExpression.arguments = [];
		enhancedForExpressionExpression.arguments.push(enhancedForExpressionArgument);	
		enhancedForExpression.expression = enhancedForExpressionExpression;

		return enhancedForExpression;
	}

	cocoJava.yy.createConsoleLogExpression = function createConsoleLogExpression(printType, expression, range){
		var consoleLogNode = new node("CallExpression");
		consoleLogNode.range = range;
		consoleLogNode.arguments = [];
		consoleLogNode.arguments.push(expression);
		var callee = new node("MemberExpression");
		callee.range = range;

		var functions = getRuntimeFunctions(range);

		var printProperty;
		if(printType == "System.out.print"){
			printProperty = createIdentifierNode("print", range);
		}else{
			printProperty = createIdentifierNode("println", range);
		}
			

		callee.object = functions;
		callee.property = printProperty;
		callee.computed  = false;

		consoleLogNode.callee = callee;

		return consoleLogNode;
	}

	cocoJava.yy.createClassCastNode = function createClassCastNode(type, typeRange, expression, range){
		var classCastNode = new node("CallExpression");
		classCastNode.range = range;
		classCastNode.arguments = [];
		if(type === "int" || type === "double" || type === "Object"){
			classCastNode.arguments.push(getArgumentForName(type, typeRange));
		}else{
			classCastNode.arguments.push(createIdentifierNode(type, typeRange));
		}
		classCastNode.arguments.push(expression);
		classCastNode.arguments.push(getArgumentForRange(range));
		classCastNode.callee = createMemberExpressionNode(getRuntimeFunctions(range),createIdentifierNode("classCast", range),range, false);
		return classCastNode;
	}

	//Get line number for when raising errors
	var lineBreak = /\r\n|[\n\r\u2028\u2029]/g;

	var getLineInfo = function(range) {
		offset = range[0];
	    for (var line = 1, cur = 0;;) {
			lineBreak.lastIndex = cur;
			var match = lineBreak.exec(javaCode);
			if (match && match.index < offset) {
				++line;
				cur = match.index + match[0].length;
			} else break;
		}
		return {line: line, column: offset - cur};
	}

	function raise(message, range) {
		var loc = getLineInfo(range);
		var err = new SyntaxError(message);
		err.pos = range[0]; err.loc = loc; err.range = range;
		throw err;
	}

	try{
		ast = cocoJava.parse(javaCode);
	}catch(err){
		if(err.hash){
			err.message = "Unexpected " + err.hash.text;
			if(err.hash.expected.indexOf("'LINE_TERMINATOR'") >= 0 ){
				err.message = err.message + " maybe a ';'' is missing!"
			};

			err.loc = {line: err.hash.line, column: err.hash.loc.first_column};
			err.range = err.hash.range
		}
		throw err;
	}
	//Add call to BufferedConsole and print it;
	var consolePrintNode = new node("ExpressionStatement");
	var consoleCall = new node("CallExpression");
	consoleCall.callee  = createMemberExpressionNode(getRuntimeFunctions([0,0]),createIdentifierNode("printLog", [0,0]),[0,0]);
	consoleCall.arguments = [];
	consolePrintNode.expression = consoleCall;

	ast.body.push(consolePrintNode);

	return ast;
}

exports.wrapFunction = wrapFunction = function(ast, functionName, className, staticCall){
	node = function(type){
		this.type = type;
	}
	astBody = ast.body;

	//check if there's a different static call other than the main
	if(className !== undefined && className !== ""  && staticCall !== undefined &&  staticCall !== ""){
		var staticCallNode = new node("ReturnStatement");

	    var staticCallNodeExpression = new node("CallExpression");

	    var myClassIndentifier = new node("Identifier");
			myClassIndentifier.name = className;
	    var staticCallProperty = new node("Identifier");
			staticCallProperty.name = staticCall;

		var staticCallCalee = new node("MemberExpression");
			staticCallCalee.computed = false;
			staticCallCalee.object = myClassIndentifier;
			staticCallCalee.property = staticCallProperty;

	    staticCallNodeExpression.callee = staticCallCalee;

	    staticCallNodeExpression.arguments = [];

	    staticCallNode.argument = staticCallNodeExpression;
	    astBody.push(staticCallNode);
	}else if(astBody[astBody.length-1].expression.type === "CallExpression"){
		// transform the static call into return that same static call
		var staticCallNode = new node("ReturnStatement");
		staticCallNode.argument = astBody[astBody.length-1].expression;
		astBody[astBody.length-1] = staticCallNode
	}

	fooFunctNode = new node("FunctionDeclaration")
	fooId = new node("Identifier");
	if(functionName){
		fooId.name = functionName;
	}else{
		fooId.name = "foo";		
	}
	fooFunctNode.id = fooId;
	fooFunctNode.params = [];

	fooBody = new node("BlockStatement");
	fooBody.body = [];
		functReturn = new node("ReturnStatement");
			functReturnArgument = new node("CallExpression");
				functReturnArgumentCallee = new node("MemberExpression");
				functReturnArgumentCallee.computed = false;
					functReturnArgumentCalleeObject = new node("FunctionExpression");
					functReturnArgumentCalleeObject.params = [];
					functReturnArgumentCalleeObject.defaults = [];
						functReturnArgumentCalleeObjectBody = new node("BlockStatement");
						functReturnArgumentCalleeObjectBody.body = astBody;
					functReturnArgumentCalleeObject.body = functReturnArgumentCalleeObjectBody;
					functReturnArgumentCalleeObject.generator = false;
					functReturnArgumentCalleeObject.expression = false;
				functReturnArgumentCallee.object = functReturnArgumentCalleeObject;
					functReturnArgumentCalleeProperty = new node("Identifier");
					functReturnArgumentCalleeProperty.name = "call";
				functReturnArgumentCallee.property = functReturnArgumentCalleeProperty;
			functReturnArgument.callee = functReturnArgumentCallee;
			functReturnArgument.arguments = [];
				functReturnArgumentArgumentThis = new node("ThisExpression");
			functReturnArgument.arguments.push(functReturnArgumentArgumentThis);

		functReturn.argument = functReturnArgument;

	fooBody.body.push(functReturn);
	fooFunctNode.body = fooBody;
	ast.body = [];
	ast.body.push(fooFunctNode);

	return ast;
}

exports.toNode = function(p){
  var node = new node();
  for(var prop in p){
    node[prop] = p[prop];
  }
  return node;
  function node(){}
}

exports.___JavaRuntime = ___JavaRuntime = {
	BufferedConsole : "",
	sourceCode: "",
	raise : function(message, range) {
		var offset = range[0];
		var lineBreak = /\r\n|[\n\r\u2028\u2029]/g;
	    for (var line = 1, cur = 0;;) {
			lineBreak.lastIndex = cur;
			var match = lineBreak.exec(___JavaRuntime.sourceCode);
			if (match && match.index < offset) {
				++line;
				cur = match.index + match[0].length;
			} else break;
		}
		var loc = {line: line, column: offset - cur};
		var err = new SyntaxError(message);
		err.pos = range[0]; err.loc = loc; err.range = range;
		throw err;
	},
	loadEnv: function(){
		___JavaRuntime.BufferedConsole = "";
		String.prototype.compareTo = function (other){
			for(var i = 0; i < this.length; i++){
				if(this[i].charCodeAt(0) != other.charCodeAt(i))
					return ___JavaRuntime.functions.createNumber(this[i].charCodeAt(0) - other.charCodeAt(i), "int");

			}
			return ___JavaRuntime.functions.createNumber(this.length - other.length, "int");
		};
		String.prototype.compareToIgnoreCase = function (other){
			for(var i = 0; i < this.length; i++){
				if(this[i].toLowerCase().charCodeAt(0) != other.toLowerCase().charCodeAt(i))
					return ___JavaRuntime.functions.createNumber(this[i].toLowerCase().charCodeAt(0) - other.toLowerCase().charCodeAt(i), "int");

			}
			return ___JavaRuntime.functions.createNumber(this.length - other.length, "int");
		};

		String.prototype._length = function(){
			return ___JavaRuntime.functions.createNumber(this.length, "int");
		};

		Array.prototype.__defineGetter__("_length", function(){return ___JavaRuntime.functions.createNumber(this.length, "int")});
		_Object = function() {

			function _Object() {
				this.__id = generateId();
			}

			var __id = 0;

			function generateId() { 
				return __id++; 
			}

			_Object.prototype.__type = "Object";

			_Object.prototype.__id = function() {
				var newId = generateId();
				this.__id = function() { return newId; };
				return newId;
			};

			_Object.prototype.equals = function(other) {
				return this === other;
			};

			_Object.prototype.toString= function() {
				return this.__type + "@" + this.__id;
			};
			return _Object;

		}.call(this);

		Integer = function () {
		    Integer = function Integer(value) {
		        _Object.call(this);
		        if(value.constructor == Number){
		        	this.value = ___JavaRuntime.functions.createNumber(Math.floor(value), "int");
		        }else{
		        	throw new SyntaxError("Integer expects an int not " + value.constructor.name);
		        }
		    };
		    Integer.prototype = Object.create(_Object.prototype);
		    Integer.prototype.__type = 'Integer';
		    Integer.prototype.intValue = function () {
		        return this.value;
		    };
		    Integer.prototype.toString = function () {
		        return "" + this.value;
		    };
		    return Integer;
		}.call(this);

		Double = function () {
		    Double = function Double(value) {
		        _Object.call(this);
		        if(value.constructor == Number){
		        	this.value = ___JavaRuntime.functions.createNumber(value, "double");
		        }else{
		        	throw new SyntaxError("Double expects an int not " + value.constructor.name);
		        }
		    };
		    Double.prototype = Object.create(_Object.prototype);
		    Double.prototype.__type = 'Double';
		    Double.prototype.intValue = function () {
		        return ___JavaRuntime.functions.createNumber(Math.floor(value), "int");
		    };
		    Double.prototype.doubleValue = function () {
		        return this.value;
		    };
		    Double.prototype.toString = function () {
		        return "" + this.value;
		    };
		    return Double;
		}.call(this);

		_ArrayList = function(){
			_ArrayList = function _ArrayList(type) {
				_Object.call(this);
				throw new SyntaxError("Cannot find ArrayList");
			}
			return _ArrayList;
		}.call(this);
	},
	loadLists : function(){ 
		_ArrayList = function() {

			function _ArrayList(type) {
				_Object.call(this);
				this._type = type;
				this._arraylist = [];
			}
			_ArrayList.prototype = Object.create(_Object.prototype);
			_ArrayList.prototype.__type = 'ArrayList';
			_ArrayList.prototype.size = function() {
				return this._arraylist.length;
			};

			_ArrayList.prototype.add = function(index, object) {
				//hacky way so we can have method overload
				if (object == undefined) {
					objectType = ___JavaRuntime.functions.determineType(index);
					if(objectType == "int" && this._type == "Integer"){
						index = new Integer(index);
					}
					if(objectType == "double" && this._type == "Double"){
						index = new Integer(index);
					}
					//updates the type after autoboxing;
					objectType = ___JavaRuntime.functions.determineType(index);
					if(objectType !=  this._type){
						throw new SyntaxError("No suitable 'add' method found for " + objectType);
					}
					this._arraylist.push(index);
					return true;
				} else {
					objectType = ___JavaRuntime.functions.determineType(object);
					if(objectType == "int" && this._type == "Integer"){
						object = new Integer(object);
					}
					if(objectType == "double" && this._type == "Double"){
						object = new Integer(object);
					}
					//updates the type after autoboxing;
					object = ___JavaRuntime.functions.determineType(object);
					if(objectType !=  this._type){
						throw new SyntaxError("No suitable 'add' method found for " + objectType);
					}
					if (index > 0 && index < this._arraylist.length) {
						this._arraylist.splice(index, 0, object);
						return true;
					} else {
						throw new SyntaxError("Index out of bounds Exception!");
					}
				}
			};

			_ArrayList.prototype.get = function(index) {
				if (index < 0 || index > this._arraylist.length) {
					throw new SyntaxError("Index out of bounds Exception!");
				}
				return this._arraylist[index];
			};

			_ArrayList.prototype.set = function(index, object) {
				var old;
				objectType = ___JavaRuntime.functions.determineType(object);
				if(objectType == "int" && this._type == "Integer"){
					object = new Integer(object);
				}
				if(objectType == "double" && this._type == "Double"){
					object = new Integer(object);
				}
				//updates the type after autoboxing;
				objectType = ___JavaRuntime.functions.determineType(object);
				if(objectType !=  this._type){
					throw new SyntaxError("No suitable 'set' method found for " + objectType);
				}
				if (index < 0 || index > this._arraylist.length) {
					throw new SyntaxError("Index out of bounds Exception!");
				}
				var old = this._arraylist[index];
				if(___JavaRuntime.functions.determineType(index) == "int" || ___JavaRuntime.functions.determineType(index)== "Integer"){
					if(___JavaRuntime.functions.determineType(index) == "Integer"){
						this._arraylist[index.intValue()] = object;
						}else{
							this._arraylist[index] = object;
						}
						return old;
				}else{
					throw new SyntaxError("Incompatible types required: int, found: " + ___JavaRuntime.functions.determineType(index));	
				}
			};

			_ArrayList.prototype.remove = function(index) {
				if (index < 0 || index > this._arraylist.length) {
					throw new SyntaxError("Index out of bounds Exception!");
				}
				return this._arraylist.splice(index,1);
			};

			return _ArrayList;

		}.call(this);

	},
	functions : {
		printLog: function(str){
			console.log(___JavaRuntime.BufferedConsole);
		},
		print: function(str){
			___JavaRuntime.BufferedConsole += str;
		},
		println: function(str){
			___JavaRuntime.BufferedConsole += str;
			___JavaRuntime.BufferedConsole += "\n";
		},
		createNumber: function(value, javaType){
			var _temp = new Number(value);
			_temp._type = javaType;
			return _temp;
		}
		,
		//FIXME: chaneged validateSet to checkAssignment, most validations will be in the AST soon
		checkAssignment: function(value, variable, arrayIndex1, arrayIndex2, javaType, range){
			if(typeof value === "function")
				value = value();

			var varRawType;

			if (javaType){
				varRawType = javaType.replace(/\[/g,'').replace(/\]/g,'');
				if(javaType.indexOf("[][]")>-1){
					//if either the new value and the variable are arrays
					if (value.constructor === Array){
						if(value[0].constructor === Array){
							//both are arrays: fine
						}else{
							throw new SyntaxError("Incompatible types");
						}
					}else{
						//if the value is an array but it's not 2-d
						throw new SyntaxError("Incompatible types");
					}
				} else if(javaType.indexOf("[]")>-1){
					//if both value and variables are arrays
					if (value.constructor === Array && arrayIndex1 == undefined){
						if(value[0].constructor === Array){
							//if value is a 2-d array
							throw new SyntaxError("Incompatible types");
						}else{
							//value is a 1-d array: fine
						}
					}else{
						//variable is array but value isn't
						throw new SyntaxError("Incompatible types");
					}
				}else{
					if(javaType == 'int' || javaType == 'Integer'){
						if(value.constructor == Number){
							return Math.floor(value);
						}else{
							throw new SyntaxError("Int cannot accept " + value.constructor);
						}
					}else if(javaType == 'double' || javaType == 'Double'){
						if(value.constructor == Number){
							return value;
						}else{
							throw new SyntaxError("Double cannot accept " + value.constructor);
						}
					}else if(javaType == 'String'){
						if(value.constructor  == String){
							return value;
						}else{
							throw new SyntaxError("String cannot accept " + value.constructor);
						}
					}	
				}
			}
			if(variable){
				//If the variable is assigned already we can try determine the type
				//Check first if the variable is an array
				if (variable.constructor == Array){
					if (variable[0].constructor == Array){
						//variable is a 2-d array
						if (value.constructor === Array){
							if(value[0].constructor === Array){
								// value is also a 2-d array: fine
							}else{
								//value isnt a 2-d array
								throw new SyntaxError("Incompatible types");
							}
						}else{
							//value isnt an array
							throw new SyntaxError("Incompatible types");
						}
					}else{
						//variable is a 1-d array
						if (value.constructor === Array){
							if(value[0].constructor === Array){
								//value isnt a 1-d array
								throw new SyntaxError("Incompatible types");
							}else{
								// value is also a 1-d array: fine
							}
						}
					}
				}else{
					//if it's not an array it could be an integer, double, string, userType
					if(variable.constructor == Number){
						if(variable % 1 != 0){
							//current variable is a double
							if(value.constructor == Number){
								return value;
							}else{
								throw new SyntaxError("Double cannot accept " + value.constructor);
							}
						}else{
							//current variable is an int
							if(value.constructor == Number){
								return Math.floor(value);
							}else{
								throw new SyntaxError("Int cannot accept " + value.constructor);
							}
						}
					}else if(variable.constructor == String){
						if(value.constructor  == String){
							return value;
						}else{
							throw new SyntaxError("String cannot accept " + value.constructor);
						}
					}
				}
			}else{
				//If we cant check returns the variable anyway
				return value;
			}
		},
		validateSet: function(value, variable, arrayIndex1, arrayIndex2, ASTNodeID){
			if(typeof value === "function")
				value = value();
			
			//Removes the '__' from the variable name
			var index = parseInt(variableName.substring(2));
			var varRawType = ___JavaRuntime.variablesDictionary[index].type;
			var type;
			//check the type
			if(___JavaRuntime.variablesDictionary[index].type.indexOf("[][]")>-1){
				//if either the new value and the variable are arrays
				if (value.constructor === Array){
					if(value[0].constructor === Array){
						if(value instanceof _Object){
							type = variable.type;
							type = type + "[][]"
						}else{
							type = varRawType;
						}
					}else if(arrayIndex1 != undefined && value[0].constructor !== Array){
						//if the assign contains 1 index the variable can receive an array
						varRawType = ___JavaRuntime.variablesDictionary[index].type.replace('[','').replace(']','');
						if(value instanceof _Object){
							type = variable.type;
							type = type + "[]"
						}else{
							type = varRawType;
						}
					}else{
						throw new SyntaxError("Incompatible types");
					}
				} else if (arrayIndex2 != undefined && value.constructor !== Array){
					//if the assign contains 2 indexes the variable can receive only the basic type
					varRawType = ___JavaRuntime.variablesDictionary[index].type.replace(/\[/g,'').replace(/\]/g,'');
				}else{
					//if the variable is an array but the value is incompatible
					throw new SyntaxError("Incompatible types");
				}
			} else if(___JavaRuntime.variablesDictionary[index].type.indexOf("[]")>-1){
				//if both value and variables are arrays
				if (value.constructor === Array && arrayIndex1 == undefined){
					if(value[0].constructor === Array){
						throw new SyntaxError("Incompatible types");
					}
					if(value instanceof _Object){
						type = variable.type;
						type = type + "[]"
					}else{
						type = varRawType;
					}
				}else if(arrayIndex1 != undefined){
					//if there's an index the array can recive only the basic type

					varRawType = ___JavaRuntime.variablesDictionary[index].type.replace('[','').replace(']','');
				}else{
					throw new SyntaxError("Incompatible types");
				}

			}
			
			if(arrayIndex1){
				if(typeof arrayIndex1 === "function")
					arrayIndex1 = arrayIndex1();
				if(typeof arrayIndex1 != 'number' || arrayIndex1 % 1 !== 0){
					throw new SyntaxError("Array index must be an integer");
				}else if(variable.constructor !== Array){
					throw new SyntaxError("Incompatible types");
				}else if(arrayIndex1 < 0 || arrayIndex1 >= variable.length){
					throw new SyntaxError("Array index out of bounds");
				}
			}
			if(arrayIndex2){
				if(typeof arrayIndex2 === "function")
					arrayIndex2 = arrayIndex2();
				if(typeof arrayIndex2 != 'number' || arrayIndex2 % 1 !== 0){
					throw new SyntaxError("Array index must be an integer");
				}else if(variable.constructor !== Array){
					throw new SyntaxError("Incompatible types");
				}else if(arrayIndex2 < 0 || arrayIndex2 >= variable[arrayIndex1].length){
					throw new SyntaxError("Array index out of bounds");
				}
			}
			switch (varRawType){
				case 'int':
					if (typeof value === 'number'){
						return Math.floor(value);
					}
					throw new SyntaxError("This is not an int maybe a cast is missing");
					break;
				case 'double':
					if (typeof value === 'number'){
						return value;
					}
					throw new SyntaxError("This is not a double maybe a cast is missing");
					break;
				case 'boolean':
					if (typeof value === 'boolean'){
						return value;
					}
					throw new SyntaxError("This is not a boolean maybe a cast is missing");
					break;
				case 'String':
					if (typeof value === 'string'){
						return value;
					}
					throw new SyntaxError("This is not a String maybe a cast is missing");
					break;
				case type:
					return value;
					break;
				default:
					break;
			}
		},
		determineType: function(value){
			if(value == undefined){
				return undefined;
			}
			if (value.constructor == Array){
				if (value[0].constructor == Array){
					if(value[0][0].constructor == Number){
						return value[0][0]._type;
					}else if(value[0][0].constructor == String){
						return "String[][]";
					}else if(typeof value[0][0] == "object"){
						if(value[0][0].__type){
							return value[0][0].__type + "[][]";
						}
					}
				}else{
					//current variable is an 1-d array
					if(value[0].constructor == Number){
						return value[0]._type;
					}else if(value[0].constructor == String){
						return "String[]";
					}else if(typeof value[0] == "object"){
						if(value[0].__type){
							return value[0].__type + "[]";
						}
					}
				}
		}else{
				//if it's not an array it could be an integer, double, string, userType
				if(value.constructor == Number){
					return value._type;
				}else if(value.constructor == String){
					return "String";
				}else if(value instanceof _Object){
					if(value.__type){
						return value.__type;
					}
				}
			}
			//if cant check the type its wildcard type
			return "?";
		},
		validateIndex: function(value, range){
			if(typeof value === "function")
				value = value();
			if (typeof value === 'number'){
						if (value % 1 === 0){
							return value;
						}else{
							throw new SyntaxError("Possible loss of precision, received double, expected int");
						}
			}
			throw new SyntaxError("Incompatible types, received "+ typeof value  +", expected int");

		},
		classCast: function(type, value, range){
			if(type.constructor == String){
				if (value.constructor == Number){
						if(type === "int"){
							return ___JavaRuntime.functions.createNumber(Math.floor(value), "int");
						}else if (type === "double"){
							return ___JavaRuntime.functions.createNumber(value, "double");
						}
					}
				if(value instanceof Integer){
					if(type === "int"){
						return value.intValue();
					}else if (type === "double"){
						return ___JavaRuntime.functions.createNumber(value.intValue(), "double");
					}
				}
				if(value instanceof _Object && value.hasOwnProperty("value")){
					if(type === "int"){
						return ___JavaRuntime.functions.createNumber(Math.floor(value.value),"int");
					}else if (type === "double"){
						return ___JavaRuntime.functions.createNumber(value.value, "double");
					}
				}
				if(value instanceof Double){
					if(type === "int"){
						return ___JavaRuntime.functions.createNumber(Math.floor(value.doubleValue()), "int");
					}else if (type === "double"){
						return value.doubleValue();
					}
				}
				if(type == "Object"){
					if(value instanceof _Object){
						//if it's an object instance convert back to object
						value.__type = "Object";
						value.__proto__ = Object.create(_Object.prototype).__proto__;
						return value;
					}else{
						//if it isn't an object and it's a number set the value as a new number;

						var __temp   = new _Object();
						if (value.constructor == Number){
							__temp.value = value;
						}
						if (value.constructor == String){
							__temp.__string = value;
						}
						return __temp
					}
				}
				___JavaRuntime.raise("Incompatible types " + value.__type + " cannot be cast to " + type, range);
			}
			else if(type == String){
				if(value instanceof _Object){
					if(value.hasOwnProperty("__string")){
						return value.__string;
					}else{
						___JavaRuntime.raise("Invalid Class cast " + value.__type + " cannot be cast to String", range);
					}
				}else{
					return ""+ value;
				}
			}
			else if(value.constructor == Number){
				if(type == Integer){
					return new Integer(value);
				}
				if(type == Double){
					return new Double(value);
				}
			}
			else{
				if(value instanceof _Object){
					value.__proto__ = Object.create(type.prototype).__proto__;
					value.__type = value.__proto__.__type;
					return value;
				}else {
					___JavaRuntime.raise("Invalid Class cast", range);
				}
			}
		}
	},
	ops : {
		eq: function(arg1, arg2){
			if(arg1.constructor == Number && arg2.constructor == Number){
				return Number(arg1) == Number(arg2);
			}else{
				return arg1 == arg2;
			}
		},
		neq: function(arg1, arg2){
			if(arg1.constructor == Number && arg2.constructor == Number){
				return Number(arg1) != Number(arg2);
			}else{
				return arg1 != arg2;
			}
		},
		//Needed since switch in javascript does '===' and can't compare object numbers
		fixSwitch: function(arg, range){
			tArg = ___JavaRuntime.functions.determineType(arg);
			if(tArg == "String"){
				return arg
			}else if(tArg == "Integer"){
				return Number(arg.intValue());
			}else if (tArg == "int"){
				return Number(arg);
			}
			___JavaRuntime.raise("Switch requires int or String but got " + tArg, range);
		},
		add: function(arg1, arg2){
			tArg1 = ___JavaRuntime.functions.determineType(arg1);
			tArg2 = ___JavaRuntime.functions.determineType(arg2);
			if(tArg1 != "String" && tArg1 != "int" && tArg1 != "double" && tArg1 != "Integer"  && tArg1 != "Double"){
				throw new SyntaxError("Bad operand type for '+' got " + tArg1);
			}
			if(tArg1 == "Integer" || tArg1 == "Double"){
				arg1 = arg1.value;
			}
			if(tArg2 == "Integer" || tArg2 == "Double"){
				arg2 = arg2.value;
			}
			if(tArg1 == "String"){
				return arg1 + arg2;
			}
			if(tArg1 == "Integer"){
				return new Integer(Math.floor(arg1 + arg2));
			}
			if(tArg1 == "Double"){
				return new Double(arg1 + arg2);
			}
			if(tArg1 == "int"){
				return ___JavaRuntime.functions.createNumber(Math.floor(arg1 + arg2), "int");
			}
			return ___JavaRuntime.functions.createNumber(arg1 + arg2, "double");
		},
		sub: function(arg1, arg2){
			tArg1 = ___JavaRuntime.functions.determineType(arg1);
			tArg2 = ___JavaRuntime.functions.determineType(arg2);
			if(tArg1 != "int" && tArg1 != "double" && tArg1 != "Integer"  && tArg1 != "Double"){
				throw new SyntaxError("Bad operand type for '-' got " + tArg1);
			}
			if(tArg2 != "int" && tArg2 != "double" && tArg2 != "Integer"  && tArg2 != "Double"){
				throw new SyntaxError("Bad operand type for '-' got " + tArg2);
			}
			if(tArg1 == "Integer" || tArg1 == "Double"){
				arg1 = arg1.value;
			}
			if(tArg2 == "Integer" || tArg2 == "Double"){
				arg2 = arg2.value;
			}
			if(tArg1 == "Integer"){
				return new Integer(Math.floor(arg1 - arg2));
			}
			if(tArg1 == "Double" ){
				return new Double(arg1 - arg2);
			}
			if(tArg1 == "int"){
				return ___JavaRuntime.functions.createNumber(Math.floor(arg1 - arg2), "int");
			}
			return ___JavaRuntime.functions.createNumber(arg1 - arg2, "double");
		},
		mul: function(arg1, arg2){
			tArg1 = ___JavaRuntime.functions.determineType(arg1);
			tArg2 = ___JavaRuntime.functions.determineType(arg2);
			if(tArg1 != "int" && tArg1 != "double" && tArg1 != "Integer"  && tArg1 != "Double"){
				throw new SyntaxError("Bad operand type for '*' got " + tArg1);
			}
			if(tArg2 != "int" && tArg2 != "double" && tArg2 != "Integer"  && tArg2 != "Double"){
				throw new SyntaxError("Bad operand type for '*' got " + tArg2);
			}
			if(tArg1 == "Integer" || tArg1 == "Double"){
				arg1 = arg1.value;
			}
			if(tArg2 == "Integer" || tArg2 == "Double"){
				arg2 = arg2.value;
			}
			if(tArg1 == "Integer"){
				return new Integer(Math.floor(arg1 * arg2));
			}
			if(tArg1 == "Double" ){
				return new Double(arg1 * arg2);
			}
			if(tArg1 == "int"){
				return ___JavaRuntime.functions.createNumber(Math.floor(arg1 * arg2), "int");
			}
			return ___JavaRuntime.functions.createNumber(arg1 * arg2, "double");
		},
		div: function(arg1, arg2){
			tArg1 = ___JavaRuntime.functions.determineType(arg1);
			tArg2 = ___JavaRuntime.functions.determineType(arg2);
			if(tArg1 != "int" && tArg1 != "double" && tArg1 != "Integer"  && tArg1 != "Double"){
				throw new SyntaxError("Bad operand type for '/' got " + tArg1);
			}
			if(tArg2 != "int" && tArg2 != "double" && tArg2 != "Integer"  && tArg2 != "Double"){
				throw new SyntaxError("Bad operand type for '/' got " + tArg2);
			}
			if(tArg1 == "Integer" || tArg1 == "Double"){
				arg1 = arg1.value;
			}
			if(tArg2 == "Integer" || tArg2 == "Double"){
				arg2 = arg2.value;
			}
			if(tArg1 == "Integer"){
				return new Integer(Math.floor(arg1 / arg2));
			}
			if(tArg1 == "Double" ){
				return new Double(arg1 / arg2);
			}
			if(tArg1 == "int"){
				return ___JavaRuntime.functions.createNumber(Math.floor(arg1 / arg2), "int");
			}
			return ___JavaRuntime.functions.createNumber(arg1 / arg2, "double");
		},
		mod: function(arg1, arg2){
			tArg1 = ___JavaRuntime.functions.determineType(arg1);
			tArg2 = ___JavaRuntime.functions.determineType(arg2);
			if(tArg1 != "int" && tArg1 != "double" && tArg1 != "Integer"  && tArg1 != "Double"){
				throw new SyntaxError("Bad operand type for '%' got " + tArg1);
			}
			if(tArg2 != "int" && tArg2 != "double" && tArg2 != "Integer"  && tArg2 != "Double"){
				throw new SyntaxError("Bad operand type for '%' got " + tArg2);
			}
			if(tArg1 == "Integer" || tArg1 == "Double"){
				arg1 = arg1.value;
			}
			if(tArg2 == "Integer" || tArg2 == "Double"){
				arg2 = arg2.value;
			}
			if(tArg1 == "Integer"){
				return new Integer(Math.floor(arg1 % arg2));
			}
			if(tArg1 == "Double" ){
				return new Double(arg1 % arg2);
			}
			if(tArg1 == "int"){
				return ___JavaRuntime.functions.createNumber(Math.floor(arg1 % arg2), "int");
			}
			return ___JavaRuntime.functions.createNumber(arg1 % arg2, "double");
		},
	},
}


});
