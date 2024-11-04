function bashPrompt() {
	alert('Would you liken to learn more about deno terminal?');
	console.log('The message has been acknowledged.');
	const shouldProceed = confirm('Do you want to proceed?');
    if (!shouldProceed) {
        console.log('User has cancelled the operation.');
        return;
    }
	console.log('Should proceed?', shouldProceed);
	const name = prompt('Please enter your name:');
	console.log('Name:', name);
	const age = prompt('Please enter your age:', '18');
	console.log('Age:', age);
}

bashPrompt();