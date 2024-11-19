
import {neutral,chuck,jokesMap} from './data1.js';
import {data2} from './data2.js';
import {data3} from './data3.js';
import {data4} from './data4.js';

interface Joke {
	body: string;
	title?: string;
	punchline?: string;
}

const jokes: Joke[] = []

function setup() {
	const jsonData = Deno.readTextFileSync("data5.json");
	const items: { body: string, title: string }[] = JSON.parse(jsonData);
	items.forEach(item => {
		const joke:Joke = {
			title: item.title,
			body: item.body,
		}
		jokes.push(joke);
	})
	console.log(jokes.length);
	neutral.forEach(txt => jokes.push({body: txt}));
	console.log(jokes.length);

	chuck.forEach(txt => jokes.push({body: txt}));
	console.log(jokes.length);

	const jokeList:any[] = Object.values(jokesMap);
	jokeList.forEach(joke => {
		jokes.push({body: joke.q, punchline: joke.a});
	})
	console.log(jokes.length);

	data2.forEach(item => jokes.push({
		body: item.setup,
		punchline: item.punchline
	}));
	console.log(jokes.length);

	data3.forEach(item =>{
		jokes.push({
			body: item.body
		})
	})
	console.log(jokes.length);

	data4.forEach(item =>{
		jokes.push({
			body: item.body,
			title: item.title
		})
	});

	const jsonStr = JSON.stringify(jokes);
	Deno.writeTextFileSync("jokes.json", jsonStr);

}

setup();