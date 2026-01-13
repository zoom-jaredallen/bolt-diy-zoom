import { useState } from 'react';
import type { ProviderInfo } from '~/types/model';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('usePromptEnhancement');

export function usePromptEnhancer() {
  const [enhancingPrompt, setEnhancingPrompt] = useState(false);
  const [promptEnhanced, setPromptEnhanced] = useState(false);

  const resetEnhancer = () => {
    setEnhancingPrompt(false);
    setPromptEnhanced(false);
  };

  const enhancePrompt = async (
    input: string,
    setInput: (value: string) => void,
    model: string,
    provider: ProviderInfo,
    apiKeys?: Record<string, string>,
  ) => {
    setEnhancingPrompt(true);
    setPromptEnhanced(false);

    const requestBody: any = {
      message: input,
      model,
      provider,
    };

    if (apiKeys) {
      requestBody.apiKeys = apiKeys;
    }

    const originalInput = input;

    try {
      const response = await fetch('/api/enhancer', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Enhancer API returned ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();

      if (!reader) {
        throw new Error('No response body reader available');
      }

      const decoder = new TextDecoder();
      let _input = '';
      let _error;

      try {
        setInput('');

        while (true) {
          const { value, done } = await reader.read();

          if (done) {
            break;
          }

          _input += decoder.decode(value);

          logger.trace('Set input', _input);

          setInput(_input);
        }
      } catch (error) {
        _error = error;
      }

      // Handle errors or empty responses
      if (_error) {
        logger.error('Error during streaming:', _error);
        setInput(originalInput);
      } else if (!_input || _input.trim() === '') {
        // Response was empty - restore original input
        logger.warn('Empty response from enhancer, restoring original input');
        setInput(originalInput);
      } else {
        // Success - set the final enhanced input
        setTimeout(() => {
          setInput(_input);
        });
      }
    } catch (error) {
      logger.error('Enhancer request failed:', error);
      setInput(originalInput);
    } finally {
      setEnhancingPrompt(false);
      setPromptEnhanced(true);
    }
  };

  return { enhancingPrompt, promptEnhanced, enhancePrompt, resetEnhancer };
}
