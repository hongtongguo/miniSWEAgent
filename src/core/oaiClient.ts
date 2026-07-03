import OpenAI from "openai";
import { API_KEY, API_ENDPOINT } from "../constant";

const openai = new OpenAI({
  baseURL: API_ENDPOINT,
  apiKey: API_KEY,
});

export default openai;
